import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import {
  collectAllPages,
  GbpError,
  gbpGet,
  GBP_DAILY_METRICS,
  GBP_KEYWORD_PAGE_SIZE,
  multiDailyMetricsPath,
  normalizeMultiDailyMetrics,
  normalizeSearchKeywordCounts,
  searchKeywordsPath,
  type GbpFetchMultiResponse,
  type GbpSearchKeywordResponse,
} from "@/lib/googleBusinessGateway";
import {
  addDaysIso,
  daysBetweenInclusive,
  firstOfMonth,
  keywordSyncMonths,
  officeToday,
  resolveMonthRange,
} from "@/lib/googlePerformance";
import type {
  GooglePerformanceAggregateRow,
  GooglePerformanceContext,
  GooglePerformanceOfficeRow,
  GooglePerformanceSeriesPoint,
  GooglePerformanceSummary,
  GooglePerformanceSyncJob,
  GoogleSearchKeywordRow,
} from "@/types/googleBusiness";

/**
 * Phase 8 server functions: read the cached performance analytics and drive the
 * Google -> Supabase sync.
 *
 * The dashboard reads Supabase only; the sync worker is the only caller that
 * touches Google's Performance API. Every write goes through a Phase 8 RPC, so
 * office ownership holds even if a caller forges a payload. Google tokens live
 * in the connector gateway — DARB never sees or stores them.
 *
 * A keyword failure never discards a healthy metrics sync: the two are separate
 * jobs and a PARTIAL status records exactly what lagged.
 */

const attachBearer = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);

function gbpCreds(): { lovableKey: string; connectionKey: string } | null {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_BUSINESS_PROFILE_API_KEY"];
  if (!lovableKey || !connectionKey) return null;
  return { lovableKey, connectionKey };
}

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

/** Office Google identity, resolved server-side — never from the client. */
type MappingIdentity = {
  google_account_id: string;
  google_location_id: string;
  google_location_resource_name: string;
};

async function loadOfficeIdentity(
  ctx: SupabaseCtx,
  officeId: string,
): Promise<MappingIdentity> {
  const rows = await rpcOrThrow<MappingIdentity[]>(
    ctx,
    "get_office_google_mapping",
    {
      p_office_id: officeId,
    },
  );
  const row = rows?.[0];
  if (!row?.google_account_id || !row?.google_location_id) {
    throw new Error("Office has no mapped Google location");
  }
  return row;
}

/** Google's Performance API accepts an unobfuscated listing id, not a resource name. */
function locationIdFromResourceName(resourceName: string): string | null {
  const match = /^locations\/(\d+)$/.exec(resourceName?.trim() ?? "");
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Error normalization (Phase 8 §63/§64). A Google failure and "Google has no
// data yet" are different states and must not collapse into one message.
// ---------------------------------------------------------------------------

type PerformanceErrorCode =
  | "GOOGLE_PERFORMANCE_NOT_AVAILABLE"
  | "GOOGLE_LOCATION_NOT_VERIFIED"
  | "GOOGLE_PERMISSION_DENIED"
  | "GOOGLE_PERFORMANCE_QUOTA"
  | "GOOGLE_PERFORMANCE_TIMEOUT"
  | "GOOGLE_PERFORMANCE_STALE"
  | "GOOGLE_PERFORMANCE_PAGINATION";

function normalizePerformanceError(error: unknown): {
  code: PerformanceErrorCode;
  message: string;
} {
  const err =
    error instanceof GbpError
      ? error
      : new GbpError(
          "upstream",
          0,
          (error as Error)?.message ?? "Google request failed",
        );
  const message = err.message || "Google request failed";
  const lower = message.toLowerCase();
  if (err.status === 401)
    return { code: "GOOGLE_PERFORMANCE_NOT_AVAILABLE", message };
  if (err.status === 403) return { code: "GOOGLE_PERMISSION_DENIED", message };
  if (err.status === 429) return { code: "GOOGLE_PERFORMANCE_QUOTA", message };
  if (
    err.code === "network" ||
    lower.includes("timeout") ||
    lower.includes("timed out")
  ) {
    return { code: "GOOGLE_PERFORMANCE_TIMEOUT", message };
  }
  if (lower.includes("verified")) {
    return { code: "GOOGLE_LOCATION_NOT_VERIFIED", message };
  }
  if (lower.includes("pagination")) {
    return { code: "GOOGLE_PERFORMANCE_PAGINATION", message };
  }
  if (
    err.status === 404 ||
    lower.includes("not available") ||
    lower.includes("not found")
  ) {
    return { code: "GOOGLE_PERFORMANCE_NOT_AVAILABLE", message };
  }
  return { code: "GOOGLE_PERFORMANCE_NOT_AVAILABLE", message };
}

// ---------------------------------------------------------------------------
// Read: performance context (office timezone + sync state)
// ---------------------------------------------------------------------------

/** Offices the caller may view Insights for (admin: all mapped; operator: theirs). */
export const listGooglePerformanceOffices = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).parse(input))
  .handler(async ({ context }) => {
    return rpcOrThrow<GooglePerformanceOfficeRow[]>(
      context as unknown as SupabaseCtx,
      "list_google_performance_offices",
      {},
    );
  });

export const getGooglePerformanceContext = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: { officeId: string }) =>
    z.object({ officeId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const rows = await rpcOrThrow<GooglePerformanceContext[]>(
      context as unknown as SupabaseCtx,
      "get_office_google_performance_context",
      { p_office_id: data.officeId },
    );
    return rows?.[0] ?? null;
  });

// ---------------------------------------------------------------------------
// Read: summary for a period (current vs previous)
// ---------------------------------------------------------------------------

const summarySchema = z.object({
  officeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  previousStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  previousEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const getGooglePerformanceSummary = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof summarySchema>) =>
    summarySchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.startDate > data.endDate) throw new Error("Invalid date range");
    const rows = await rpcOrThrow<GooglePerformanceSummary[]>(
      context as unknown as SupabaseCtx,
      "get_office_google_performance_summary",
      {
        p_office_id: data.officeId,
        p_start_date: data.startDate,
        p_end_date: data.endDate,
        p_prev_start_date: data.previousStartDate ?? null,
        p_prev_end_date: data.previousEndDate ?? null,
      },
    );
    return rows?.[0] ?? null;
  });

// ---------------------------------------------------------------------------
// Read: daily series for charting
// ---------------------------------------------------------------------------

const seriesSchema = z.object({
  officeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  metrics: z.array(z.string()).optional(),
});

export const getGooglePerformanceSeries = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof seriesSchema>) =>
    seriesSchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.startDate > data.endDate) throw new Error("Invalid date range");
    return rpcOrThrow<GooglePerformanceSeriesPoint[]>(
      context as unknown as SupabaseCtx,
      "get_office_google_performance_series",
      {
        p_office_id: data.officeId,
        p_start_date: data.startDate,
        p_end_date: data.endDate,
        p_metrics: data.metrics ?? null,
      },
    );
  });

// ---------------------------------------------------------------------------
// Read: monthly search keywords (paginated, server-filtered)
// ---------------------------------------------------------------------------

const keywordsSchema = z.object({
  officeId: z.string().uuid(),
  startMonth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endMonth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  search: z.string().max(120).optional(),
  sort: z.enum(["impressions_desc", "keyword_asc"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

export const getGoogleSearchKeywords = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof keywordsSchema>) =>
    keywordsSchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    return rpcOrThrow<GoogleSearchKeywordRow[]>(
      context as unknown as SupabaseCtx,
      "list_office_google_search_keywords",
      {
        p_office_id: data.officeId,
        p_start_month: data.startMonth ?? null,
        p_end_month: data.endMonth ?? null,
        p_search: data.search?.trim() || null,
        p_sort: data.sort ?? "impressions_desc",
        p_limit: data.limit ?? 25,
        p_offset: data.offset ?? 0,
      },
    );
  });

// ---------------------------------------------------------------------------
// Read: sync job observability
// ---------------------------------------------------------------------------

export const getGooglePerformanceSyncJobs = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: { officeId: string; limit?: number }) =>
    z
      .object({
        officeId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return rpcOrThrow<GooglePerformanceSyncJob[]>(
      context as unknown as SupabaseCtx,
      "list_office_google_performance_sync_jobs",
      { p_office_id: data.officeId, p_limit: data.limit ?? 10 },
    );
  });

// ---------------------------------------------------------------------------
// Read: admin all-offices aggregate (AAL2)
// ---------------------------------------------------------------------------

const aggregateSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  previousStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  previousEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  officeIds: z.array(z.string().uuid()).optional(),
});

export const getGooglePerformanceAggregate = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof aggregateSchema>) =>
    aggregateSchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.startDate > data.endDate) throw new Error("Invalid date range");
    return rpcOrThrow<GooglePerformanceAggregateRow[]>(
      context as unknown as SupabaseCtx,
      "admin_google_performance_aggregate",
      {
        p_start_date: data.startDate,
        p_end_date: data.endDate,
        p_prev_start_date: data.previousStartDate ?? null,
        p_prev_end_date: data.previousEndDate ?? null,
        p_office_ids: data.officeIds ?? null,
      },
    );
  });

// ---------------------------------------------------------------------------
// Audit: a meaningful view/export, not every hover
// ---------------------------------------------------------------------------

export const recordGooglePerformanceAudit = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator(
    (input: {
      officeId: string;
      action: string;
      detail?: Record<string, unknown>;
    }) =>
      z
        .object({
          officeId: z.string().uuid(),
          action: z.enum([
            "GOOGLE_PERFORMANCE_VIEWED",
            "GOOGLE_PERFORMANCE_EXPORTED",
          ]),
          detail: z.record(z.string(), z.unknown()).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await rpcOrThrow<void>(
      context as unknown as SupabaseCtx,
      "admin_record_google_performance_audit",
      {
        p_office_id: data.officeId,
        p_action: data.action,
        p_after_data: data.detail ?? {},
      },
    );
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Sync: metrics + keywords for an office
// ---------------------------------------------------------------------------

/** Recent re-fetch window. Google data can change or arrive late, so each sync
 *  re-fetches a recent window and upserts rather than appending. */
const RECENT_SYNC_DAYS = 7;

/** Google caps the keyword endpoint page size at 100. */
const KEYWORD_PAGE_SIZE = 100;
/** Safety bound so an export can never loop unboundedly on a broken cursor. */
const MAX_KEYWORD_EXPORT_PAGES = 100;
/** A backfill never silently runs for a decade; the server clamps the span. */
const MAX_BACKFILL_DAYS = 550;
/** Months of keyword history a sync refreshes (one Google request per month). */
const KEYWORD_BACKFILL_MONTHS = 5;

/**
 * Walks the keyword list RPC page by page so the CSV export contains every
 * keyword in the range, not just the first screen. Ordered deterministically
 * server-side and bounded so a broken cursor cannot loop forever.
 */
async function collectAllKeywordPages(
  ctx: SupabaseCtx,
  args: { officeId: string; startMonth: string; endMonth: string },
): Promise<GoogleSearchKeywordRow[]> {
  const rows: GoogleSearchKeywordRow[] = [];
  for (let page = 0; page < MAX_KEYWORD_EXPORT_PAGES; page += 1) {
    const batch = await rpcOrThrow<GoogleSearchKeywordRow[]>(
      ctx,
      "list_office_google_search_keywords",
      {
        p_office_id: args.officeId,
        p_start_month: args.startMonth,
        p_end_month: args.endMonth,
        p_search: null,
        p_sort: "impressions_desc",
        p_limit: KEYWORD_PAGE_SIZE,
        p_offset: page * KEYWORD_PAGE_SIZE,
      },
    );
    if (!batch || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < KEYWORD_PAGE_SIZE) break;
  }
  return rows;
}

const SYNC_RETRY_ATTEMPTS = 3;

export type PerformanceSyncResult = {
  ok: boolean;
  status:
    "synced" | "partial" | "not_linked" | "locked" | "no_mapping" | "error";
  metrics: { inserted: number; updated: number; deleted: number } | null;
  keywords: { inserted: number; updated: number } | null;
  dataThrough: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type SyncPhaseResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: PerformanceErrorCode; message: string };

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = SYNC_RETRY_ATTEMPTS,
): Promise<SyncPhaseResult<T>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return { ok: true, value: await fn() };
    } catch (error) {
      lastError = error;
      // Never retry an auth/permission problem: retrying cannot fix it and only
      // burns quota.
      if (
        error instanceof GbpError &&
        (error.status === 401 || error.status === 403)
      )
        break;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      }
    }
  }
  const normalized = normalizePerformanceError(lastError);
  return { ok: false, code: normalized.code, message: normalized.message };
}

/**
 * Runs one performance sync for an office. Metrics and keywords are attempted
 * independently; if metrics land and keywords fail the result is PARTIAL and the
 * stored metrics survive.
 */
export async function runGooglePerformanceSync(
  ctx: SupabaseCtx,
  officeId: string,
  options: { includeKeywords?: boolean; days?: number } = {},
): Promise<PerformanceSyncResult> {
    const creds = gbpCreds();
    if (!creds) {
      return {
        ok: false,
        status: "not_linked",
        metrics: null,
        keywords: null,
        dataThrough: null,
        errorCode: "not_linked",
        errorMessage: "Google Business is not connected.",
      };
    }

    const identity = await loadOfficeIdentity(ctx, officeId).catch(
      () => null,
    );
    if (!identity) {
      return {
        ok: false,
        status: "no_mapping",
        metrics: null,
        keywords: null,
        dataThrough: null,
        errorCode: "GOOGLE_PERFORMANCE_NOT_AVAILABLE",
        errorMessage: "Office has no mapped Google location.",
      };
    }
    const locationId =
      locationIdFromResourceName(identity.google_location_resource_name) ??
      identity.google_location_id;

    // Office-timezone context, resolved server-side.
    const contextRows = await rpcOrThrow<GooglePerformanceContext[]>(
      ctx,
      "get_office_google_performance_context",
      { p_office_id: officeId },
    );
    const timeZone = contextRows?.[0]?.timezone || "UTC";

    const endDate = officeToday(timeZone);
    const startDate = addDaysIso(
      endDate,
      -((options.days ?? RECENT_SYNC_DAYS) - 1),
    );

    const lockToken = await rpcOrThrow<string | null>(
      ctx,
      "acquire_google_performance_sync_lock",
      {
        p_office_id: officeId,
        p_stale_after_seconds: 300,
      },
    );
    if (!lockToken) {
      return {
        ok: false,
        status: "locked",
        metrics: null,
        keywords: null,
        dataThrough: null,
        errorCode: "locked",
        errorMessage: "A performance sync is already running for this office.",
      };
    }

    const metricsResult = await syncMetricsPhase(ctx, {
      officeId: officeId,
      locationId,
      startDate,
      endDate,
      lockToken,
      creds,
    });

    let keywordsResult: { inserted: number; updated: number } | null = null;
    let keywordsError: { code: PerformanceErrorCode; message: string } | null =
      null;
    // Keywords are secondary: a failed metrics phase has already recorded the
    // failure and released the lock, so there is no point (and no valid lock)
    // for a keyword request.
    if (metricsResult.ok && options.includeKeywords !== false) {
      const kw = await syncKeywordsPhase(ctx, {
        officeId: officeId,
        locationId,
        timeZone,
        lockToken,
        creds,
      });
      if (kw.ok) keywordsResult = kw.value;
      else keywordsError = { code: kw.code, message: kw.message };
    }

    await rpcOrThrow<void>(ctx, "release_google_performance_sync_lock", {
      p_office_id: officeId,
      p_token: lockToken,
    });

    if (!metricsResult.ok) {
      return {
        ok: false,
        status: "error",
        metrics: null,
        keywords: keywordsResult,
        dataThrough: null,
        errorCode: metricsResult.code,
        errorMessage: metricsResult.message,
      };
    }

    // data-through is what Google actually reported, never the requested end
    // date: a lagging or empty response must not look current.
    const dataThrough = metricsResult.value.dataThrough;

    if (keywordsError) {
      return {
        ok: true,
        status: "partial",
        metrics: metricsResult.value,
        keywords: null,
        dataThrough,
        errorCode: keywordsError.code,
        errorMessage: keywordsError.message,
      };
    }

    return {
      ok: true,
      status: "synced",
      metrics: metricsResult.value,
      keywords: keywordsResult,
      dataThrough,
      errorCode: null,
      errorMessage: null,
    };
}

export const syncGooglePerformance = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator(
    (input: { officeId: string; includeKeywords?: boolean; days?: number }) =>
      z
        .object({
          officeId: z.string().uuid(),
          includeKeywords: z.boolean().optional(),
          days: z.number().int().min(1).max(MAX_BACKFILL_DAYS).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }): Promise<PerformanceSyncResult> =>
    runGooglePerformanceSync(context as unknown as SupabaseCtx, data.officeId, {
      includeKeywords: data.includeKeywords,
      days: data.days,
    }),
  );

async function syncMetricsPhase(
  ctx: SupabaseCtx,
  args: {
    officeId: string;
    locationId: string;
    startDate: string;
    endDate: string;
    lockToken: string;
    creds: { lovableKey: string; connectionKey: string };
  },
): Promise<
  SyncPhaseResult<{
    inserted: number;
    updated: number;
    deleted: number;
    dataThrough: string | null;
  }>
> {
  const jobId = await rpcOrThrow<string>(
    ctx,
    "admin_create_google_performance_sync_job",
    {
      p_office_id: args.officeId,
      p_sync_type: "METRICS",
      p_start_date: args.startDate,
      p_end_date: args.endDate,
    },
  );

  const fetched = await withRetry(async () => {
    const path = multiDailyMetricsPath(
      args.locationId,
      GBP_DAILY_METRICS,
      args.startDate,
      args.endDate,
    );
    return gbpGet<GbpFetchMultiResponse>(path, args.creds);
  });

  if (!fetched.ok) {
    await rpcOrThrow<void>(ctx, "admin_fail_google_performance_sync_job", {
      p_job_id: jobId,
      p_status: "FAILED",
      p_token: args.lockToken,
      p_error_code: fetched.code,
      p_error_message: fetched.message,
    });
    return fetched;
  }

  const rows = normalizeMultiDailyMetrics(fetched.value, GBP_DAILY_METRICS);
  const saved = await rpcOrThrow<
    {
      inserted: number;
      updated: number;
      deleted: number;
      data_through: string | null;
    }[]
  >(ctx, "admin_complete_google_performance_metrics_job", {
    p_job_id: jobId,
    p_token: args.lockToken,
    p_rows: rows,
    p_metrics: [...GBP_DAILY_METRICS],
    p_start_date: args.startDate,
    p_end_date: args.endDate,
  });
  const row = saved?.[0];
  return {
    ok: true,
    value: {
      inserted: row?.inserted ?? 0,
      updated: row?.updated ?? 0,
      deleted: row?.deleted ?? 0,
      dataThrough: row?.data_through ?? null,
    },
  };
}

async function syncKeywordsPhase(
  ctx: SupabaseCtx,
  args: {
    officeId: string;
    locationId: string;
    timeZone: string;
    lockToken: string;
    creds: { lovableKey: string; connectionKey: string };
  },
): Promise<SyncPhaseResult<{ inserted: number; updated: number }>> {
  // Google's keyword endpoint AGGREGATES impressions across the whole
  // `monthlyRange` and returns no per-month field, so a multi-month request
  // cannot be attributed to any single month. Fetch one month per request and
  // store each month's own value, so a row's `month` is truthful.
  const { endMonth } = resolveMonthRange(1, args.timeZone);
  const months = keywordSyncMonths(endMonth, KEYWORD_BACKFILL_MONTHS);
  const jobId = await rpcOrThrow<string>(
    ctx,
    "admin_create_google_performance_sync_job",
    {
      p_office_id: args.officeId,
      p_sync_type: "KEYWORDS",
      p_start_date: months[months.length - 1],
      p_end_date: endMonth,
    },
  );

  const fetched = await withRetry(async () => {
    const collected: ReturnType<typeof normalizeSearchKeywordCounts> = [];
    for (const month of months) {
      const page = await collectAllPages<
        ReturnType<typeof normalizeSearchKeywordCounts>[number]
      >(async (pageToken) => {
        const res = await gbpGet<GbpSearchKeywordResponse>(
          searchKeywordsPath(
            args.locationId,
            month,
            month,
            pageToken,
            GBP_KEYWORD_PAGE_SIZE,
          ),
          args.creds,
        );
        return {
          items: normalizeSearchKeywordCounts(res),
          nextPageToken: res.nextPageToken ?? undefined,
        };
      });
      // A truncated listing (page ceiling or repeated cursor) is not a complete
      // picture of the month. Reconciling from it would delete terms Google
      // still reports, so treat it as a retryable failure and keep the cache.
      if (!page.complete) {
        throw new GbpError(
          "upstream",
          0,
          "Google search keyword pagination was truncated.",
        );
      }
      for (const row of page.items) collected.push({ ...row, month });
    }
    return collected;
  });

  if (!fetched.ok) {
    await rpcOrThrow<void>(ctx, "admin_fail_google_performance_sync_job", {
      p_job_id: jobId,
      p_status: "FAILED",
      p_token: args.lockToken,
      p_error_code: fetched.code,
      p_error_message: fetched.message,
    });
    return fetched;
  }

  const saved = await rpcOrThrow<{ inserted: number; updated: number }[]>(
    ctx,
    "admin_complete_google_performance_keywords_job",
    {
      p_job_id: jobId,
      p_token: args.lockToken,
      p_rows: fetched.value,
      p_month: endMonth,
    },
  );
  return { ok: true, value: saved?.[0] ?? { inserted: 0, updated: 0 } };
}

// ---------------------------------------------------------------------------
// Sync: admin historical backfill
// ---------------------------------------------------------------------------

export const backfillGooglePerformance = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator(
    (input: { officeId: string; startDate: string; endDate: string }) =>
      z
        .object({
          officeId: z.string().uuid(),
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .parse(input),
  )
  .handler(async ({ data, context }): Promise<PerformanceSyncResult> => {
    const ctx = context as unknown as SupabaseCtx;
    const creds = gbpCreds();
    if (!creds) {
      return {
        ok: false,
        status: "not_linked",
        metrics: null,
        keywords: null,
        dataThrough: null,
        errorCode: "not_linked",
        errorMessage: "Google Business is not connected.",
      };
    }
    if (data.startDate > data.endDate) throw new Error("Invalid date range");
    const span = daysBetweenInclusive(data.startDate, data.endDate);
    if (span > MAX_BACKFILL_DAYS) {
      throw new Error(`Backfill is limited to ${MAX_BACKFILL_DAYS} days`);
    }

    const identity = await loadOfficeIdentity(ctx, data.officeId).catch(
      () => null,
    );
    if (!identity) {
      return {
        ok: false,
        status: "no_mapping",
        metrics: null,
        keywords: null,
        dataThrough: null,
        errorCode: "GOOGLE_PERFORMANCE_NOT_AVAILABLE",
        errorMessage: "Office has no mapped Google location.",
      };
    }
    const locationId =
      locationIdFromResourceName(identity.google_location_resource_name) ??
      identity.google_location_id;

    const lockToken = await rpcOrThrow<string | null>(
      ctx,
      "acquire_google_performance_sync_lock",
      {
        p_office_id: data.officeId,
        p_stale_after_seconds: 300,
      },
    );
    if (!lockToken) {
      return {
        ok: false,
        status: "locked",
        metrics: null,
        keywords: null,
        dataThrough: null,
        errorCode: "locked",
        errorMessage: "A performance sync is already running for this office.",
      };
    }

    // Chunk the backfill so one Google response never spans an unreasonable range.
    const CHUNK_DAYS = 90;
    let cursor = data.startDate;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;
    let maxDataThrough: string | null = null;
    let failure: { code: PerformanceErrorCode; message: string } | null = null;

    while (cursor <= data.endDate) {
      const chunkEndCandidate = addDaysIso(cursor, CHUNK_DAYS - 1);
      const chunkEnd =
        chunkEndCandidate > data.endDate ? data.endDate : chunkEndCandidate;
      const phase = await syncMetricsPhase(ctx, {
        officeId: data.officeId,
        locationId,
        startDate: cursor,
        endDate: chunkEnd,
        lockToken,
        creds,
      });
      if (!phase.ok) {
        failure = { code: phase.code, message: phase.message };
        break;
      }
      totalInserted += phase.value.inserted;
      totalUpdated += phase.value.updated;
      totalDeleted += phase.value.deleted;
      if (
        phase.value.dataThrough &&
        (!maxDataThrough || phase.value.dataThrough > maxDataThrough)
      ) {
        maxDataThrough = phase.value.dataThrough;
      }
      cursor = addDaysIso(chunkEnd, 1);
    }

    await rpcOrThrow<void>(ctx, "release_google_performance_sync_lock", {
      p_office_id: data.officeId,
      p_token: lockToken,
    });

    if (failure) {
      return {
        ok: false,
        status: "error",
        metrics: {
          inserted: totalInserted,
          updated: totalUpdated,
          deleted: totalDeleted,
        },
        keywords: null,
        dataThrough: null,
        errorCode: failure.code,
        errorMessage: failure.message,
      };
    }
    return {
      ok: true,
      status: "synced",
      metrics: {
        inserted: totalInserted,
        updated: totalUpdated,
        deleted: totalDeleted,
      },
      keywords: null,
      dataThrough: maxDataThrough,
      errorCode: null,
      errorMessage: null,
    };
  });

// ---------------------------------------------------------------------------
// Export support: the full dataset for the requested range, for the CSV builder.
// Kept server-side so the export is office-scoped exactly like the dashboard.
// ---------------------------------------------------------------------------

const exportSchema = z.object({
  officeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  includeKeywords: z.boolean().optional(),
  includeMetrics: z.boolean().optional(),
});

export type GooglePerformanceExport = {
  series: GooglePerformanceSeriesPoint[];
  keywords: GoogleSearchKeywordRow[];
  timezone: string;
  officeName: string | null;
  googleLocationName: string | null;
};

export const getGooglePerformanceExport = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof exportSchema>) =>
    exportSchema.parse(input),
  )
  .handler(async ({ data, context }): Promise<GooglePerformanceExport> => {
    const ctx = context as unknown as SupabaseCtx;
    if (data.startDate > data.endDate) throw new Error("Invalid date range");
    const contextRows = await rpcOrThrow<GooglePerformanceContext[]>(
      ctx,
      "get_office_google_performance_context",
      { p_office_id: data.officeId },
    );
    const info = contextRows?.[0];
    const series =
      data.includeMetrics === false
        ? []
        : await rpcOrThrow<GooglePerformanceSeriesPoint[]>(
            ctx,
            "get_office_google_performance_series",
            {
              p_office_id: data.officeId,
              p_start_date: data.startDate,
              p_end_date: data.endDate,
              p_metrics: null,
            },
          );
    const keywords =
      data.includeKeywords === false
        ? []
        : await collectAllKeywordPages(ctx, {
            officeId: data.officeId,
            startMonth: firstOfMonth(data.startDate),
            endMonth: firstOfMonth(data.endDate),
          });
    return {
      series,
      keywords,
      timezone: info?.timezone ?? "UTC",
      officeName: info?.office_name ?? null,
      googleLocationName: info?.google_location_name ?? null,
    };
  });
