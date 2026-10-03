import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import {
  classifyGoogleBusinessEvent,
  decodePubSubEnvelope,
  eventPriority,
  eventSyncType,
  GoogleEventParseError,
  payloadHashInput,
  sha256Hex,
  type GoogleBusinessEvent,
} from "@/lib/googleBusinessEvents";
import {
  GBP_DEPRECATED_EVENT_TYPES,
  GBP_SUPPORTED_EVENT_TYPES,
} from "@/lib/googleBusinessEvents";

/**
 * Phase 9 server functions: the event pipeline and the background worker.
 *
 * Three responsibilities, deliberately separated:
 *   - the webhook captures and QUEUES an event (never does heavy work),
 *   - the worker orchestrates the existing Phase 5-8 sync services,
 *   - the admin reads expose health, events and dead letters.
 *
 * The office for an event is ALWAYS derived by the database from the Google
 * location mapping (`route_google_business_event`); a payload never supplies an
 * office id.
 */

const attachBearer = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);

type SupabaseCtx = {
  supabase: {
    rpc: (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };
  userId: string;
};

async function rpcOrThrow<T>(
  context: SupabaseCtx,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await context.supabase.rpc(fn, args);
  if (error) throw new Error(error.message || "Request failed");
  return data as T;
}

async function adminRpcOrThrow<T>(
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { supabaseAdmin } =
    await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc(fn as never, args as never);
  if (error) throw new Error(error.message || "Request failed");
  return data as T;
}

async function requireAdmin(context: SupabaseCtx): Promise<void> {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || isAdmin !== true)
    throw new Response("Forbidden", { status: 403 });
}

/**
 * The worker runs as the service role with no user session. The Phase 5-8 sync
 * cores only use `ctx` for RPC calls and for the actor id in audit rows, so a
 * context whose RPCs are forwarded to the admin client is sufficient — and the
 * service-role RPCs behind it still authorize the write.
 */
const SYNC_CTX = {
  supabase: {
    rpc: (fn: string, args?: Record<string, unknown>) =>
      import("@/integrations/supabase/client.server").then(
        ({ supabaseAdmin }) => supabaseAdmin.rpc(fn as never, args as never),
      ),
  },
  userId: "",
} as unknown as SupabaseCtx;

// ---------------------------------------------------------------------------
// Webhook capture (server-side only; called from the push route)
// ---------------------------------------------------------------------------

export interface CaptureEventResult {
  eventId: string;
  isDuplicate: boolean;
  processingStatus: string;
  routingStatus: string;
  officeId: string | null;
}

/**
 * Persists one decoded Google event and routes it. Idempotent on the Pub/Sub
 * message id, so a redelivered message never creates a second event or job.
 *
 * Runs as the service role: this is the trusted side of the pipeline. It is
 * never exposed as an authenticated server function.
 */
export async function captureAndRouteGoogleEvent(
  messageId: string,
  event: GoogleBusinessEvent,
  rawPayload: unknown,
): Promise<CaptureEventResult> {
  const payloadHash = await sha256Hex(payloadHashInput(event));

  const recorded = await adminRpcOrThrow<
    {
      event_id: string;
      is_duplicate: boolean;
      processing_status: string;
      routing_status: string;
      office_id: string | null;
    }[]
  >("record_google_business_event", {
    p_google_message_id: messageId,
    p_event_type: event.rawType,
    p_google_account_id: event.googleAccountId,
    p_google_location_id: event.googleLocationId,
    p_google_resource_name: event.googleResourceName,
    p_google_event_id: event.googleEventId,
    p_payload_hash: payloadHash,
    p_payload: rawPayload,
  });
  const row = recorded?.[0];
  if (!row?.event_id) throw new Error("Event was not recorded");

  // A redelivery is a no-op once the event is routed or deliberately ignored.
  // An event still UNROUTED means a prior attempt persisted it and then failed
  // before routing (the transient case the webhook's 500-then-retry contract
  // exists for), so fall through and retry the idempotent route instead of
  // stranding the event with no office, job, or notification.
  if (row.is_duplicate && row.routing_status !== "UNROUTED") {
    return {
      eventId: row.event_id,
      isDuplicate: true,
      processingStatus: row.processing_status,
      routingStatus: row.routing_status,
      officeId: row.office_id,
    };
  }

  // Route immediately: resolving the office and queuing a job is cheap (no
  // Google calls), and it lets the worker pick the job up without a second hop.
  const routed = await adminRpcOrThrow<
    {
      event_id: string;
      event_type: string;
      routing_status: string;
      office_id: string | null;
      sync_job_id: string | null;
      sync_type: string | null;
      priority: string | null;
      is_duplicate: boolean;
    }[]
  >("route_google_business_event", { p_event_id: row.event_id });
  const r = routed?.[0];

  return {
    eventId: row.event_id,
    isDuplicate: row.is_duplicate,
    processingStatus: r?.routing_status === "ROUTED" ? "QUEUED" : "IGNORED",
    routingStatus: r?.routing_status ?? "UNROUTED",
    officeId: r?.office_id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Worker — orchestrate the existing Phase 5-8 sync services
// ---------------------------------------------------------------------------

export type SyncJobStatus = "SUCCESS" | "PARTIAL" | "FAILED";

export interface ProcessJobResult {
  jobId: string;
  syncType: string;
  status: SyncJobStatus;
  recordsProcessed: number;
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * The sync types the worker dispatches.
 *
 * The Phase 5-8 sync cores already take their own self-expiring per-office
 * lock, so a queued job and a manual sync cannot hit Google concurrently; a
 * locked core reports PARTIAL (retryable) rather than a false failure.
 */
async function runSyncType(
  officeId: string,
  syncType: string,
  triggerEventId: string | null,
  triggerEventType: string | null,
): Promise<{
  status: SyncJobStatus;
  records: number;
  errorCode: string | null;
  errorMessage: string | null;
}> {
  switch (syncType) {
    case "REVIEWS": {
      const { runGoogleReviewsSync } =
        await import("@/lib/googleBusinessReviews.functions");
      const r = await runGoogleReviewsSync(SYNC_CTX, officeId);
      return toResult(r.status === "synced", r.status === "error", {
        records: r.inserted + r.updated,
        errorCode: r.errorCode,
        errorMessage: r.errorMessage,
        lockedStatus: r.status === "locked",
        unlinkedStatus: r.status === "not_linked",
      });
    }
    case "MEDIA": {
      const { runGoogleMediaSync } =
        await import("@/lib/googleBusinessMedia.functions");
      const r = await runGoogleMediaSync(SYNC_CTX, officeId);
      return toResult(r.status === "synced", r.status === "error", {
        records: r.inserted + r.updated,
        errorCode: r.errorCode,
        errorMessage: r.errorMessage,
        lockedStatus: r.status === "locked",
        unlinkedStatus: r.status === "not_linked",
      });
    }
    case "POSTS": {
      const { runGooglePostsSync } =
        await import("@/lib/googleBusinessPosts.functions");
      const r = await runGooglePostsSync(SYNC_CTX, officeId);
      return toResult(r.status === "synced", r.status === "error", {
        records: r.inserted + r.updated,
        errorCode: r.errorCode,
        errorMessage: r.errorMessage,
        lockedStatus: r.status === "locked",
        unlinkedStatus: r.status === "not_linked",
      });
    }
    case "PROFILE": {
      const { runGoogleProfileSync } =
        await import("@/lib/googleBusinessProfile.functions");
      const r = await runGoogleProfileSync(SYNC_CTX, officeId, false);
      return toResult(
        r.status === "synced" ||
          r.status === "unchanged" ||
          r.status === "external_change",
        r.status === "error",
        {
          records: r.changedFields.length,
          errorCode: r.errorCode,
          errorMessage: r.errorMessage,
          lockedStatus: r.status === "locked",
          unlinkedStatus:
            r.status === "not_linked" || r.status === "not_mapped",
        },
      );
    }
    case "PERFORMANCE": {
      const { runGooglePerformanceSync } =
        await import("@/lib/googleBusinessPerformance.functions");
      const r = await runGooglePerformanceSync(SYNC_CTX, officeId, {});
      const metrics = r.metrics;
      const keywords = r.keywords;
      return toResult(
        r.status === "synced" || r.status === "partial",
        r.status === "error",
        {
          records:
            (metrics ? metrics.inserted + metrics.updated : 0) +
            (keywords ? keywords.inserted + keywords.updated : 0),
          errorCode: r.errorCode,
          errorMessage: r.errorMessage,
          lockedStatus: r.status === "locked",
          unlinkedStatus:
            r.status === "not_linked" || r.status === "no_mapping",
        },
      );
    }
    case "HEALTH": {
      const { runGoogleHealthRefresh } =
        await import("@/lib/googleBusinessHealth.server");
      // The triggering event's row id lets a real health transition raise the
      // Admin/office alert through the same per-event dedupe as other events.
      // The original event type keeps the audience correct (VOM/duplicate go to
      // Admin, not the office).
      const r = await runGoogleHealthRefresh(officeId, {
        source: "EVENT",
        eventType: triggerEventType ?? "HEALTH_CHECK",
        googleEventId: triggerEventId,
      });
      return {
        status: r.ok ? "SUCCESS" : "FAILED",
        records: 0,
        errorCode: r.errorCode,
        errorMessage: r.errorMessage,
      };
    }
    case "FULL":
      // FULL is a bookkeeping row: `create_google_business_sync_job` already
      // enqueued the component jobs, which each run on their own. Completing it
      // immediately keeps it from blocking the queue ahead of its components.
      return {
        status: "SUCCESS",
        records: 0,
        errorCode: null,
        errorMessage: null,
      };
    default:
      return {
        status: "FAILED",
        records: 0,
        errorCode: "UNKNOWN_SYNC_TYPE",
        errorMessage: `Unsupported sync type: ${syncType}`,
      };
  }
}

function toResult(
  ok: boolean,
  failed: boolean,
  detail: {
    records: number;
    errorCode: string | null;
    errorMessage: string | null;
    lockedStatus?: boolean;
    unlinkedStatus?: boolean;
  },
): {
  status: SyncJobStatus;
  records: number;
  errorCode: string | null;
  errorMessage: string | null;
} {
  if (detail.lockedStatus) {
    // Another sync already holds the office lock; let this job retry rather
    // than reporting a false failure.
    return {
      status: "PARTIAL",
      records: 0,
      errorCode: "LOCKED",
      errorMessage: "Another sync holds the office lock",
    };
  }
  if (detail.unlinkedStatus) {
    // Nothing to sync because Google is not connected: not a transient error,
    // so it must not burn retries.
    return {
      status: "PARTIAL",
      records: 0,
      errorCode: detail.errorCode ?? "NOT_LINKED",
      errorMessage: detail.errorMessage,
    };
  }
  if (ok)
    return {
      status: "SUCCESS",
      records: detail.records,
      errorCode: null,
      errorMessage: null,
    };
  if (failed) {
    return {
      status: "FAILED",
      records: detail.records,
      errorCode: detail.errorCode ?? "SYNC_FAILED",
      errorMessage: detail.errorMessage ?? "Google synchronization failed",
    };
  }
  return {
    status: "PARTIAL",
    records: detail.records,
    errorCode: detail.errorCode,
    errorMessage: detail.errorMessage,
  };
}

/**
 * Claims one queued sync job (or all queued jobs, for the drainer), runs it and
 * finalizes it through the lock-token RPC. Returns the jobs processed.
 */
export async function processGoogleBusinessSyncJobs(
  options: {
    officeId?: string | null;
    syncTypes?: string[] | null;
    max?: number;
  } = {},
): Promise<ProcessJobResult[]> {
  const max = Math.min(Math.max(options.max ?? 5, 1), 25);
  const results: ProcessJobResult[] = [];

  for (let i = 0; i < max; i += 1) {
    const claimed = await adminRpcOrThrow<
      {
        job_id: string;
        office_id: string;
        sync_type: string;
        priority: string;
        lock_token: string;
        google_location_id: string | null;
        trigger_event_id: string | null;
        trigger_event_type: string | null;
      }[]
    >("claim_google_business_sync_job", {
      p_office_id: options.officeId ?? null,
      p_sync_types: options.syncTypes ?? null,
    });
    const job = claimed?.[0];
    if (!job?.job_id) break;

    let outcome: Awaited<ReturnType<typeof runSyncType>>;
    try {
      outcome = await runSyncType(
        job.office_id,
        job.sync_type,
        job.trigger_event_id,
        job.trigger_event_type,
      );
    } catch (e) {
      outcome = {
        status: "FAILED",
        records: 0,
        errorCode: "WORKER_ERROR",
        errorMessage: e instanceof Error ? e.message : "Unknown worker error",
      };
    }

    const finished = await adminRpcOrThrow<
      { finalized: boolean; job_status: string; will_retry: boolean }[]
    >("finish_google_business_sync_job", {
      p_job_id: job.job_id,
      p_token: job.lock_token,
      p_status: outcome.status,
      p_records_processed: outcome.records,
      p_error_code: outcome.errorCode,
      p_error_message: outcome.errorMessage,
    });
    const fin = finished?.[0];

    // Terminalize the triggering event exactly once, once the job is truly
    // done retrying: PROCESSED on success, FAILED while a retry is pending,
    // DEAD_LETTERED when the attempts are exhausted. This is what drives the
    // event's processing status and the connection's failure/dead-letter
    // counters, and what lets Admin retry a dead-lettered event.
    if (fin?.finalized && job.trigger_event_id) {
      if (!fin.will_retry) {
        const failed = fin.job_status === "FAILED";
        await adminRpcOrThrow<boolean>("mark_google_business_event", {
          p_event_id: job.trigger_event_id,
          p_status: failed ? "DEAD_LETTERED" : "PROCESSED",
          p_error_code: outcome.errorCode,
          p_error_message: outcome.errorMessage,
        }).catch(() => undefined);
      } else {
        await adminRpcOrThrow<boolean>("mark_google_business_event", {
          p_event_id: job.trigger_event_id,
          p_status: "FAILED",
          p_error_code: outcome.errorCode,
          p_error_message: outcome.errorMessage,
        }).catch(() => undefined);
      }
    }

    // A sync failure on an event-driven job is surfaced to Admin.
    if (outcome.status === "FAILED" && job.trigger_event_id) {
      await notifySyncFailure(
        job.office_id,
        job.trigger_event_id,
        outcome.errorMessage,
      );
    }

    results.push({
      jobId: job.job_id,
      syncType: job.sync_type,
      status: outcome.status,
      recordsProcessed: outcome.records,
      errorCode: outcome.errorCode,
      errorMessage: outcome.errorMessage,
    });
  }

  return results;
}

async function notifySyncFailure(
  officeId: string,
  eventId: string,
  message: string | null,
): Promise<void> {
  try {
    await adminRpcOrThrow<number>("notify_google_business_event", {
      p_event_id: eventId,
      p_office_id: officeId,
      p_event_type: "GOOGLE_SYNC_FAILED",
      p_entity_type: "sync_job",
      p_entity_id: null,
      p_extra: { summary: message ?? "A Google synchronization failed." },
    });
  } catch (e) {
    console.warn("notify_google_business_event failed:", (e as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Admin server functions
// ---------------------------------------------------------------------------

const listEventsInput = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  status: z.string().max(40).nullable().optional(),
  officeId: z.string().uuid().nullable().optional(),
});

export interface AdminEventRow {
  eventId: string;
  eventType: string;
  routingStatus: string;
  processingStatus: string;
  officeId: string | null;
  officeName: string | null;
  googleLocationId: string | null;
  googleMessageId: string | null;
  googleEventId: string | null;
  attemptCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
  totalCount: number;
}

/** Admin: the raw event log (with payloads). Admin-only by RPC. */
export const adminListGoogleEvents = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) => listEventsInput.parse(input))
  .handler(async ({ context, data }): Promise<AdminEventRow[]> => {
    const ctx = context as unknown as SupabaseCtx;
    const rows = await rpcOrThrow<
      (AdminEventRow & { payload_json: unknown })[]
    >(ctx, "admin_list_google_business_events", {
      p_limit: data.limit ?? 50,
      p_offset: data.offset ?? 0,
      p_status: data.status ?? null,
      p_office_id: data.officeId ?? null,
    });
    return rows ?? [];
  });

export interface AdminEventTimelineRow {
  eventId: string;
  eventType: string;
  routingStatus: string;
  processingStatus: string;
  officeId: string | null;
  officeName: string | null;
  googleLocationId: string | null;
  receivedAt: string;
  processedAt: string | null;
}

/** Admin: the event timeline (no payloads) for the operations page. */
export const adminGoogleEventTimeline = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).optional(),
        officeId: z.string().uuid().nullable().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<AdminEventTimelineRow[]> => {
    const ctx = context as unknown as SupabaseCtx;
    const rows =
      (await rpcOrThrow<
        {
          event_id: string;
          event_type: string;
          routing_status: string;
          processing_status: string;
          office_id: string | null;
          office_name: string | null;
          google_location_id: string | null;
          received_at: string;
          processed_at: string | null;
        }[]
      >(ctx, "admin_google_event_timeline", {
        p_limit: data.limit ?? 100,
        p_office_id: data.officeId ?? null,
      })) ?? [];
    return rows.map((r) => ({
      eventId: r.event_id,
      eventType: r.event_type,
      routingStatus: r.routing_status,
      processingStatus: r.processing_status,
      officeId: r.office_id,
      officeName: r.office_name,
      googleLocationId: r.google_location_id,
      receivedAt: r.received_at,
      processedAt: r.processed_at,
    }));
  });

export interface AdminDeadLetterRow {
  eventId: string;
  eventType: string;
  officeId: string | null;
  officeName: string | null;
  googleLocationId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  receivedAt: string;
  processedAt: string | null;
}

/** Admin: the dead-letter queue. */
export const adminListGoogleDeadLetters = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ limit: z.number().int().min(1).max(200).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<AdminDeadLetterRow[]> => {
    const ctx = context as unknown as SupabaseCtx;
    const rows =
      (await rpcOrThrow<
        {
          event_id: string;
          event_type: string;
          office_id: string | null;
          office_name: string | null;
          google_location_id: string | null;
          error_code: string | null;
          error_message: string | null;
          attempt_count: number;
          received_at: string;
          processed_at: string | null;
        }[]
      >(ctx, "admin_list_google_dead_letters", {
        p_limit: data.limit ?? 50,
      })) ?? [];
    return rows.map((r) => ({
      eventId: r.event_id,
      eventType: r.event_type,
      officeId: r.office_id,
      officeName: r.office_name,
      googleLocationId: r.google_location_id,
      errorCode: r.error_code,
      errorMessage: r.error_message,
      attemptCount: r.attempt_count,
      receivedAt: r.received_at,
      processedAt: r.processed_at,
    }));
  });

export interface AdminIntegrationHealth {
  connectionId: string;
  googleEmail: string | null;
  connectionStatus: string;
  pubsubStatus: string;
  pubsubTopic: string | null;
  pubsubSubscription: string | null;
  notificationTypes: string[] | null;
  mappedOffices: number;
  healthyMappings: number;
  lastEventReceivedAt: string | null;
  lastEventProcessedAt: string | null;
  eventFailureCount: number;
  deadLetterCount: number;
  pendingEvents: number;
  failedEvents: number;
  deadLetteredEvents: number;
  pendingJobs: number;
  runningJobs: number;
  failedJobs: number;
  officesActionRequired: number;
  officesAttention: number;
}

/** Admin: global integration health (connection, Pub/Sub, counters). */
export const adminGoogleIntegrationHealth = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminIntegrationHealth | null> => {
    const ctx = context as unknown as SupabaseCtx;
    const rows = await rpcOrThrow<
      {
        connection_id: string;
        google_email: string | null;
        connection_status: string;
        pubsub_status: string;
        pubsub_topic: string | null;
        pubsub_subscription: string | null;
        notification_types: string[] | null;
        mapped_offices: number;
        healthy_mappings: number;
        last_event_received_at: string | null;
        last_event_processed_at: string | null;
        event_failure_count: number;
        dead_letter_count: number;
        pending_events: number;
        failed_events: number;
        dead_lettered_events: number;
        pending_jobs: number;
        running_jobs: number;
        failed_jobs: number;
        offices_action_required: number;
        offices_attention: number;
      }[]
    >(ctx, "admin_google_integration_health", {});
    const r = rows?.[0];
    if (!r) return null;
    return {
      connectionId: r.connection_id,
      googleEmail: r.google_email,
      connectionStatus: r.connection_status,
      pubsubStatus: r.pubsub_status,
      pubsubTopic: r.pubsub_topic,
      pubsubSubscription: r.pubsub_subscription,
      notificationTypes: r.notification_types,
      mappedOffices: r.mapped_offices,
      healthyMappings: r.healthy_mappings,
      lastEventReceivedAt: r.last_event_received_at,
      lastEventProcessedAt: r.last_event_processed_at,
      eventFailureCount: r.event_failure_count,
      deadLetterCount: r.dead_letter_count,
      pendingEvents: Number(r.pending_events),
      failedEvents: Number(r.failed_events),
      deadLetteredEvents: Number(r.dead_lettered_events),
      pendingJobs: Number(r.pending_jobs),
      runningJobs: Number(r.running_jobs),
      failedJobs: Number(r.failed_jobs),
      officesActionRequired: r.offices_action_required,
      officesAttention: r.offices_attention,
    };
  });

export interface AdminAttentionOffice {
  officeId: string;
  officeName: string;
  healthStatus: string;
  unansweredReviews: number;
  healthReason: string | null;
  lastEventAt: string | null;
}

/** Admin: offices needing attention (health + review backlog). */
export const adminGoogleAttentionOffices = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAttentionOffice[]> => {
    const ctx = context as unknown as SupabaseCtx;
    const rows =
      (await rpcOrThrow<
        {
          office_id: string;
          office_name: string;
          health_status: string;
          unanswered_reviews: number;
          health_reason: string | null;
          last_event_at: string | null;
        }[]
      >(ctx, "admin_google_attention_offices", {})) ?? [];
    return rows.map((r) => ({
      officeId: r.office_id,
      officeName: r.office_name,
      healthStatus: r.health_status,
      unansweredReviews: r.unanswered_reviews,
      healthReason: r.health_reason,
      lastEventAt: r.last_event_at,
    }));
  });

export interface RetryEventResult {
  eventId: string;
  processingStatus: string;
  syncJobId: string | null;
}

/** Admin: retry a dead-lettered event (re-queues it through the normal router). */
export const adminRetryGoogleEvent = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ eventId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<RetryEventResult | null> => {
    const ctx = context as unknown as SupabaseCtx;
    await requireAdmin(ctx);
    const rows = await rpcOrThrow<
      {
        event_id: string;
        processing_status: string;
        sync_job_id: string | null;
      }[]
    >(ctx, "admin_retry_google_business_event", { p_event_id: data.eventId });
    const r = rows?.[0];
    if (!r) return null;
    return {
      eventId: r.event_id,
      processingStatus: r.processing_status,
      syncJobId: r.sync_job_id,
    };
  });

/** Admin: persist the verified account-level Pub/Sub configuration. */
export const adminUpdateGooglePubSubConfig = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        connectionId: z.string().uuid(),
        topic: z.string().max(300).nullable().optional(),
        subscription: z.string().max(300).nullable().optional(),
        status: z.enum([
          "not_configured",
          "connecting",
          "connected",
          "misconfigured",
          "error",
        ]),
        notificationTypes: z
          .array(z.string().max(60))
          .max(30)
          .nullable()
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as SupabaseCtx;
    await requireAdmin(ctx);
    const rows = await rpcOrThrow<
      {
        connection_id: string;
        pubsub_status: string;
        pubsub_topic: string | null;
        notification_types: string[] | null;
      }[]
    >(ctx, "admin_update_google_pubsub_config", {
      p_connection_id: data.connectionId,
      p_topic: data.topic ?? null,
      p_subscription: data.subscription ?? null,
      p_status: data.status,
      p_notification_types: data.notificationTypes ?? null,
    });
    const r = rows?.[0];
    if (!r) return null;
    return {
      connectionId: r.connection_id,
      pubsubStatus: r.pubsub_status,
      pubsubTopic: r.pubsub_topic,
      notificationTypes: r.notification_types,
    };
  });

/** The notification types DARB subscribes to, for the Admin settings UI. */
export const getGoogleNotificationTypes = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .handler(async () => ({
    supported: [...GBP_SUPPORTED_EVENT_TYPES],
    deprecated: [...GBP_DEPRECATED_EVENT_TYPES],
  }));

// ---------------------------------------------------------------------------
// Office-scoped reads and triggers (Primary / Side)
// ---------------------------------------------------------------------------

const officeInput = z.object({ officeId: z.string().uuid() });

export interface OfficeGoogleHealth {
  officeId: string;
  healthStatus: string;
  verificationState: string | null;
  voiceOfMerchantState: string | null;
  locationState: string | null;
  duplicateState: string | null;
  lastCheckedAt: string | null;
  lastEventAt: string | null;
  lastGoogleEventAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export const getOfficeGoogleHealth = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) => officeInput.parse(input))
  .handler(async ({ context, data }): Promise<OfficeGoogleHealth | null> => {
    const ctx = context as unknown as SupabaseCtx;
    const rows = await rpcOrThrow<
      {
        office_id: string;
        health_status: string;
        verification_state: string | null;
        voice_of_merchant_state: string | null;
        location_state: string | null;
        duplicate_state: string | null;
        last_checked_at: string | null;
        last_event_at: string | null;
        last_google_event_at: string | null;
        last_error_code: string | null;
        last_error_message: string | null;
      }[]
    >(ctx, "get_office_google_health", { p_office_id: data.officeId });
    const r = rows?.[0];
    if (!r) return null;
    return {
      officeId: r.office_id,
      healthStatus: r.health_status,
      verificationState: r.verification_state,
      voiceOfMerchantState: r.voice_of_merchant_state,
      locationState: r.location_state,
      duplicateState: r.duplicate_state,
      lastCheckedAt: r.last_checked_at,
      lastEventAt: r.last_event_at,
      lastGoogleEventAt: r.last_google_event_at,
      lastErrorCode: r.last_error_code,
      lastErrorMessage: r.last_error_message,
    };
  });

export interface OfficeGoogleHealthEvent {
  healthEventId: string;
  eventType: string;
  previousState: string | null;
  newState: string;
  source: string;
  createdAt: string;
}

/** Office: health state history. */
export const listOfficeGoogleHealthEvents = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        officeId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<OfficeGoogleHealthEvent[]> => {
    const ctx = context as unknown as SupabaseCtx;
    const rows =
      (await rpcOrThrow<
        {
          health_event_id: string;
          event_type: string;
          previous_state: string | null;
          new_state: string;
          source: string;
          created_at: string;
        }[]
      >(ctx, "list_office_google_health_events", {
        p_office_id: data.officeId,
        p_limit: data.limit ?? 20,
      })) ?? [];
    return rows.map((r) => ({
      healthEventId: r.health_event_id,
      eventType: r.event_type,
      previousState: r.previous_state,
      newState: r.new_state,
      source: r.source,
      createdAt: r.created_at,
    }));
  });

export interface OfficeGoogleSyncJob {
  jobId: string;
  syncType: string;
  priority: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  recordsProcessed: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
}

/** Office: sync job list + progress. */
export const listOfficeGoogleSyncJobs = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        officeId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<OfficeGoogleSyncJob[]> => {
    const ctx = context as unknown as SupabaseCtx;
    const rows =
      (await rpcOrThrow<
        {
          job_id: string;
          sync_type: string;
          priority: string;
          status: string;
          attempt_count: number;
          max_attempts: number;
          records_processed: number;
          scheduled_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          created_at: string;
        }[]
      >(ctx, "list_office_google_sync_jobs", {
        p_office_id: data.officeId,
        p_limit: data.limit ?? 20,
      })) ?? [];
    return rows.map((r) => ({
      jobId: r.job_id,
      syncType: r.sync_type,
      priority: r.priority,
      status: r.status,
      attemptCount: r.attempt_count,
      maxAttempts: r.max_attempts,
      recordsProcessed: r.records_processed,
      scheduledAt: r.scheduled_at,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      lastErrorCode: r.last_error_code,
      lastErrorMessage: r.last_error_message,
      createdAt: r.created_at,
    }));
  });

/**
 * Office: enqueue a FULL sync for this office. Runs as the service role because
 * the job queue is service-role-only; the office authorization is checked first
 * through the authorizer RPC so a Primary cannot sync someone else's office.
 */
export const requestOfficeGoogleSync = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) => officeInput.parse(input))
  .handler(
    async ({
      context,
      data,
    }): Promise<{ queued: boolean; jobId: string | null }> => {
      const ctx = context as unknown as SupabaseCtx;
      const allowed = await rpcOrThrow<boolean>(
        ctx,
        "authorize_google_office_action",
        {
          p_user_id: ctx.userId,
          p_office_id: data.officeId,
          p_action: "GOOGLE_SYNC_OFFICE",
        },
      );
      if (!allowed) throw new Response("Forbidden", { status: 403 });

      const created = await adminRpcOrThrow<
        { job_id: string; status: string; is_existing: boolean }[]
      >("create_google_business_sync_job", {
        p_office_id: data.officeId,
        p_sync_type: "FULL",
        p_priority: "NORMAL",
        p_trigger_event_id: null,
      });
      const row = created?.[0];
      return { queued: !!row?.job_id, jobId: row?.job_id ?? null };
    },
  );

/** Office: reconcile the Google event stream into a fresh review/media pull. */
export const drainOfficeGoogleSyncJobs = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) => officeInput.parse(input))
  .handler(async ({ context, data }): Promise<ProcessJobResult[]> => {
    const ctx = context as unknown as SupabaseCtx;
    const allowed = await rpcOrThrow<boolean>(
      ctx,
      "authorize_google_office_action",
      {
        p_user_id: ctx.userId,
        p_office_id: data.officeId,
        p_action: "GOOGLE_SYNC_OFFICE",
      },
    );
    if (!allowed) throw new Response("Forbidden", { status: 403 });
    return processGoogleBusinessSyncJobs({ officeId: data.officeId, max: 10 });
  });

// ---------------------------------------------------------------------------
// Phase 10 — production controls, audits and emergency switches (Admin only)
// ---------------------------------------------------------------------------

export interface GoogleBusinessControls {
  connectionId: string | null;
  googleEmail: string | null;
  globalEnabled: boolean;
  readEnabled: boolean;
  writeEnabled: boolean;
  updatedAt: string | null;
  reason: string | null;
  officesDisabled: number;
}

export interface AdminIntegrityCheck {
  checkKey: string;
  severity: string;
  violationCount: number;
  detail: string;
}

/** Admin: the effective Google Business kill switches (global row). */
export const adminGetGoogleBusinessControls = createServerFn({
  method: "POST",
})
  .middleware([attachBearer, requireSupabaseAuth])
  .handler(async ({ context }): Promise<GoogleBusinessControls | null> => {
    const ctx = context as unknown as SupabaseCtx;
    await requireAdmin(ctx);
    const rows = await rpcOrThrow<
      {
        connection_id: string | null;
        google_email: string | null;
        global_enabled: boolean;
        read_enabled: boolean;
        write_enabled: boolean;
        updated_at: string | null;
        reason: string | null;
        offices_disabled: number;
      }[]
    >(ctx, "admin_get_google_business_settings", {});
    const r = rows?.[0];
    if (!r) return null;
    return {
      connectionId: r.connection_id,
      googleEmail: r.google_email,
      globalEnabled: r.global_enabled,
      readEnabled: r.read_enabled,
      writeEnabled: r.write_enabled,
      updatedAt: r.updated_at,
      reason: r.reason,
      officesDisabled: r.offices_disabled,
    };
  });

/**
 * Admin: flip the global or a per-office kill switch. Enforced at the DB
 * authorizer and the worker, so pausing stops live Google work everywhere
 * while cached DARB data stays readable.
 */
export const adminSetGoogleBusinessControls = createServerFn({
  method: "POST",
})
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        globalEnabled: z.boolean().nullable().optional(),
        readEnabled: z.boolean().nullable().optional(),
        writeEnabled: z.boolean().nullable().optional(),
        officeId: z.string().uuid().nullable().optional(),
        officeEnabled: z.boolean().nullable().optional(),
        officeReadEnabled: z.boolean().nullable().optional(),
        officeWriteEnabled: z.boolean().nullable().optional(),
        reason: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as SupabaseCtx;
    await requireAdmin(ctx);
    const rows = await rpcOrThrow<
      {
        out_scope: string;
        out_global_enabled: boolean;
        out_read_enabled: boolean;
        out_write_enabled: boolean;
        out_office_id: string | null;
        out_office_enabled: boolean | null;
      }[]
    >(ctx, "admin_set_google_business_settings", {
      p_global_enabled: data.globalEnabled ?? null,
      p_read_enabled: data.readEnabled ?? null,
      p_write_enabled: data.writeEnabled ?? null,
      p_office_id: data.officeId ?? null,
      p_office_enabled: data.officeEnabled ?? null,
      p_office_read_enabled: data.officeReadEnabled ?? null,
      p_office_write_enabled: data.officeWriteEnabled ?? null,
      p_reason: data.reason ?? null,
    });
    return rows?.[0] ?? null;
  });

/** Admin: the full data-integrity audit across every Google table. */
export const adminGoogleIntegrityAudit = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as SupabaseCtx;
    await requireAdmin(ctx);
    const rows = await rpcOrThrow<
      {
        check_key: string;
        severity: string;
        violation_count: number;
        detail: string;
      }[]
    >(ctx, "audit_google_business_integrity", {});
    return (rows ?? []).map((r): AdminIntegrityCheck => ({
      checkKey: r.check_key,
      severity: r.severity,
      violationCount: r.violation_count,
      detail: r.detail,
    }));
  });

/** Admin: the per-office readiness report for the System Audit surface. */
export const adminOfficeGoogleIntegrity = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) => officeInput.parse(input))
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as SupabaseCtx;
    await requireAdmin(ctx);
    const rows = await rpcOrThrow<
      { item: string; ok: boolean; detail: string }[]
    >(ctx, "audit_office_google_integrity", { p_office_id: data.officeId });
    return (rows ?? []).map((r) => ({
      item: r.item,
      ok: r.ok,
      detail: r.detail,
    }));
  });

export {
  classifyGoogleBusinessEvent,
  decodePubSubEnvelope,
  GoogleEventParseError,
  eventSyncType,
  eventPriority,
};
