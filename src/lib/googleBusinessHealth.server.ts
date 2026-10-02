import {
  gbpGet,
  gbpVerificationOf,
  gbpLocationStateOf,
  locationPath,
  type GbpRawLocation,
} from "@/lib/googleBusinessGateway";

/**
 * Phase 9 health refresh.
 *
 * Reads the mapped Google location's state and records it through
 * `record_google_location_health`. The health status is derived by the database
 * (deterministic states, never a score), and a transition is only history-worthy
 * when the meaningful state actually changes.
 *
 * Runs as the service role from the background worker; also used inline by a
 * HEALTH sync job.
 */

export interface HealthRefreshResult {
  ok: boolean;
  healthStatus: string | null;
  changed: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

type AdminRpc = <T>(fn: string, args: Record<string, unknown>) => Promise<T>;

async function adminRpc<T>(
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { supabaseAdmin } =
    await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc(fn as never, args as never);
  if (error) throw new Error(error.message || "Request failed");
  return data as T;
}

function gbpCreds(): { lovableKey: string; connectionKey: string } | null {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_BUSINESS_PROFILE_API_KEY"];
  if (!lovableKey || !connectionKey) return null;
  return { lovableKey, connectionKey };
}

/** Reads the mapped location and maps Google's state fields to health inputs. */
export async function runGoogleHealthRefresh(
  officeId: string,
  options: {
    source?: "EVENT" | "SYNC" | "ADMIN" | "RECONCILE";
    eventType?: string;
    googleEventId?: string | null;
  } = {},
): Promise<HealthRefreshResult> {
  const source = options.source ?? "SYNC";
  const eventType = options.eventType ?? "HEALTH_CHECK";

  const mapping = await adminRpc<
    {
      mapping_status: string;
      google_account_id: string | null;
      google_location_id: string | null;
      connection_status: string | null;
    }[]
  >("get_office_google_mapping", { p_office_id: officeId });
  const m = mapping?.[0];

  if (
    !m ||
    m.mapping_status !== "MAPPED" ||
    !m.google_location_id ||
    !m.google_account_id
  ) {
    // Not mapped: no health to evaluate. Recorded as UNKNOWN without touching
    // any Google API.
    const rows = await adminRpc<{ health_status: string; changed: boolean }[]>(
      "record_google_location_health",
      {
        p_office_id: officeId,
        p_google_location_id: m?.google_location_id ?? null,
        p_source: source,
        p_event_type: eventType,
        p_error_code: "NOT_MAPPED",
        p_error_message: "Office has no mapped Google location.",
        p_google_event_id: options.googleEventId ?? null,
      },
    );
    return {
      ok: false,
      healthStatus: rows?.[0]?.health_status ?? "UNKNOWN",
      changed: rows?.[0]?.changed ?? false,
      errorCode: "NOT_MAPPED",
      errorMessage: "Office has no mapped Google location.",
    };
  }

  const creds = gbpCreds();
  if (!creds) {
    const rows = await adminRpc<{ health_status: string; changed: boolean }[]>(
      "record_google_location_health",
      {
        p_office_id: officeId,
        p_google_location_id: m.google_location_id,
        p_source: source,
        p_event_type: eventType,
        p_error_code: "not_linked",
        p_error_message: "Google Business connection is not configured.",
        p_google_event_id: options.googleEventId ?? null,
      },
    );
    return {
      ok: false,
      healthStatus: rows?.[0]?.health_status ?? "UNKNOWN",
      changed: rows?.[0]?.changed ?? false,
      errorCode: "not_linked",
      errorMessage: "Google Business connection is not configured.",
    };
  }

  let location: GbpRawLocation;
  try {
    location = await gbpGet<GbpRawLocation>(
      locationPath(m.google_account_id, m.google_location_id),
      creds,
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Google location read failed";
    const rows = await adminRpc<{ health_status: string; changed: boolean }[]>(
      "record_google_location_health",
      {
        p_office_id: officeId,
        p_google_location_id: m.google_location_id,
        p_source: source,
        p_event_type: eventType,
        p_error_code: "LOCATION_READ_FAILED",
        p_error_message: message,
        p_google_event_id: options.googleEventId ?? null,
      },
    );
    return {
      ok: false,
      healthStatus: rows?.[0]?.health_status ?? "UNKNOWN",
      changed: rows?.[0]?.changed ?? false,
      errorCode: "LOCATION_READ_FAILED",
      errorMessage: message,
    };
  }

  const verificationState = gbpVerificationOf(location);
  const locationState = gbpLocationStateOf(location);
  const duplicateState = location.metadata?.duplicateLocation ?? null;
  const vomState = vomStateOf(location);

  const rows = await adminRpc<
    {
      health_status: string;
      changed: boolean;
      previous_status: string | null;
    }[]
  >("record_google_location_health", {
    p_office_id: officeId,
    p_google_location_id: m.google_location_id,
    p_verification_state: verificationState,
    p_voice_of_merchant_state: vomState,
    p_location_state: locationState,
    p_duplicate_state: duplicateState,
    p_source: source,
    p_event_type: eventType,
    p_google_event_id: options.googleEventId ?? null,
  });
  const row = rows?.[0];

  // A meaningful transition is surfaced (never on a repeat of the same event,
  // which is what `changed` guarantees).
  if (row?.changed) {
    await notifyHealthTransition(
      officeId,
      row.previous_status ?? null,
      row.health_status,
      options.googleEventId ?? null,
      options.eventType ?? null,
    ).catch(() => undefined);
  }

  return {
    ok: true,
    healthStatus: row?.health_status ?? null,
    changed: row?.changed ?? false,
    errorCode: null,
    errorMessage: null,
  };
}

/** Google's Voice of Merchant signal, normalized to the DB's expected tokens. */
function vomStateOf(location: GbpRawLocation): string | null {
  const m = location.metadata;
  if (m && typeof m.hasVoiceOfMerchant === "boolean") {
    return m.hasVoiceOfMerchant ? "GOOD_STANDING" : "NOT_GOOD_STANDING";
  }
  return null;
}

async function notifyHealthTransition(
  officeId: string,
  previous: string | null,
  next: string,
  googleEventId: string | null,
  triggerEventType: string | null,
): Promise<void> {
  // Prefer the actual Google event that caused the transition, so its audience
  // is right: DUPLICATE_LOCATION and VOICE_OF_MERCHANT_UPDATED are Admin-only,
  // while a plain location-state change also reaches the office. Fall back to
  // the health-derived type when the refresh was not event-driven.
  const eventType =
    triggerEventType ??
    (next === "ACTION_REQUIRED" || next === "UNAVAILABLE"
      ? "VOICE_OF_MERCHANT_UPDATED"
      : "UPDATED_LOCATION_STATE");

  // Reuse the Phase 9 fan-out: it resolves the audience (office vs Admin) and
  // dedupes per event + recipient.
  const eventId = googleEventId;
  if (!eventId) return;
  await adminRpc("notify_google_business_event", {
    p_event_id: eventId,
    p_office_id: officeId,
    p_event_type: eventType,
    p_entity_type: "location_health",
    p_entity_id: null,
    p_extra: {
      summary: `Google location health changed from ${previous ?? "UNKNOWN"} to ${next}.`,
    },
  });
}

/** A loose admin-RPC shape used by tests. */
export type { AdminRpc };
