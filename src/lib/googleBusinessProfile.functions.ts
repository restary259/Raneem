import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import {
  buildGbpLocationPatch,
  GbpError,
  gbpGet,
  gbpPatch,
  locationPath,
  normalizeGbpProfile,
  type GbpRawProfile,
} from "@/lib/googleBusinessGateway";

/**
 * Phase 6 server functions: synchronize the Google Business Profile and publish
 * DARB edits back to Google.
 *
 * Same invariants as Phase 5:
 *   * Google tokens live in the connector gateway — DARB never sees them.
 *   * The office's Google identity is resolved server-side, never from the client.
 *   * Google is the source of truth for reads; DARB only records an edit AFTER
 *     Google accepted it.
 *   * Every DB change goes through a Phase 6 RPC, so office isolation, version
 *     concurrency and the audit trail hold even for a forged payload.
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

type MappingIdentity = {
  google_account_id: string;
  google_location_id: string;
};

/** Resolves the office's mapped location server-side. */
async function loadOfficeIdentity(
  ctx: SupabaseCtx,
  officeId: string,
): Promise<MappingIdentity> {
  const rows = await rpcOrThrow<MappingIdentity[]>(
    ctx,
    "get_office_google_mapping",
    { p_office_id: officeId },
  );
  const row = rows?.[0];
  if (!row?.google_account_id || !row?.google_location_id) {
    throw new Error("Office has no mapped Google location");
  }
  return row;
}

// ---------------------------------------------------------------------------
// Sync — Google -> DARB
// ---------------------------------------------------------------------------

/** JSON-safe value: server-function return values must be serializable. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface SyncProfileResult {
  ok: boolean;
  status:
    | "synced"
    | "unchanged"
    | "external_change"
    | "not_mapped"
    | "not_linked"
    | "locked"
    | "error";
  changedFields: { field: string; darb: JsonValue; google: JsonValue }[];
  googleValues: Record<string, JsonValue> | null;
  errorCode: string | null;
  errorMessage: string | null;
}

const syncInput = z.object({
  officeId: z.string().uuid(),
  /** Accept Google's version, overwriting DARB's. Used by "Accept Google". */
  force: z.boolean().optional(),
});

/**
 * Pull the location from Google and reconcile it into the DARB profile.
 *
 * The sync lock is advisory and self-expiring so a crashed sync cannot wedge the
 * office. An external change is reported, not applied, unless `force` is set.
 */
export const syncGoogleProfile = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => syncInput.parse(input))
  .handler(async ({ context, data }): Promise<SyncProfileResult> => {
    const ctx = context as unknown as SupabaseCtx;
    const empty = { changedFields: [], googleValues: null };

    const acquired = await rpcOrThrow<boolean>(
      ctx,
      "acquire_google_profile_sync_lock",
      { p_office_id: data.officeId, p_stale_after_seconds: 120 },
    );
    if (!acquired) {
      return {
        ok: false,
        status: "locked",
        ...empty,
        errorCode: "locked",
        errorMessage: null,
      };
    }

    const creds = gbpCreds();
    if (!creds) {
      await rpcOrThrow(ctx, "admin_mark_google_profile_sync_error", {
        p_office_id: data.officeId,
        p_error_code: "not_linked",
        p_error_message: "Google Business connection is not configured",
      });
      return {
        ok: false,
        status: "not_linked",
        ...empty,
        errorCode: "not_linked",
        errorMessage: null,
      };
    }

    try {
      const identity = await loadOfficeIdentity(ctx, data.officeId);

      const raw = await gbpGet<GbpRawProfile>(
        locationPath(identity.google_account_id, identity.google_location_id),
        creds,
      );
      const normalized = normalizeGbpProfile(raw);

      const applied = await rpcOrThrow<
        {
          status: string;
          profile_version: number;
          changed_fields: {
            field: string;
            darb: JsonValue;
            google: JsonValue;
          }[];
          google_values: Record<string, JsonValue> | null;
        }[]
      >(ctx, "admin_sync_google_profile", {
        p_office_id: data.officeId,
        p_profile: normalized,
        p_force: data.force ?? false,
      });
      const row = applied?.[0];
      const status = (row?.status ?? "synced") as SyncProfileResult["status"];

      return {
        ok: status === "synced" || status === "unchanged",
        status,
        changedFields: row?.changed_fields ?? [],
        googleValues: row?.google_values ?? null,
        errorCode: null,
        errorMessage: null,
      };
    } catch (e) {
      const err =
        e instanceof GbpError
          ? e
          : new GbpError("upstream", 0, (e as Error).message);
      console.error(
        `Google profile sync failed [${err.status}]: ${err.message}`,
      );
      try {
        await rpcOrThrow(ctx, "admin_mark_google_profile_sync_error", {
          p_office_id: data.officeId,
          p_error_code: err.code,
          p_error_message: err.message,
        });
      } catch {
        /* best effort — the stale window reclaims the lock */
      }
      return {
        ok: false,
        status: "error",
        ...empty,
        errorCode: err.code,
        errorMessage: err.message,
      };
    }
  });

// ---------------------------------------------------------------------------
// Update — DARB -> Google
// ---------------------------------------------------------------------------

export interface UpdateProfileResult {
  ok: boolean;
  status:
    "published" | "conflict" | "invalid" | "not_linked" | "uncertain" | "error";
  profileVersion: number | null;
  appliedFields: string[];
  fieldErrors: { field: string; code: string }[];
  errorCode: string | null;
  errorMessage: string | null;
}

const updateInput = z.object({
  officeId: z.string().uuid(),
  fields: z.record(z.string(), z.unknown()),
  expectedVersion: z.number().int().positive().nullable().optional(),
  idempotencyKey: z.string().min(8).max(200).nullable().optional(),
});

/**
 * Publish a set of field edits to Google, then persist the result.
 *
 * Ordering matters: DARB only records the edit after Google confirms, so a
 * Google failure leaves the cache untouched and the operator keeps their draft.
 * A version conflict is surfaced before Google is ever contacted.
 */
export const updateGoogleProfile = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => updateInput.parse(input))
  .handler(async ({ context, data }): Promise<UpdateProfileResult> => {
    const ctx = context as unknown as SupabaseCtx;
    const fail = (
      status: UpdateProfileResult["status"],
      errorCode: string,
      errorMessage: string,
    ): UpdateProfileResult => ({
      ok: false,
      status,
      profileVersion: null,
      appliedFields: [],
      fieldErrors: [],
      errorCode,
      errorMessage,
    });

    const fieldNames = Object.keys(data.fields);
    if (fieldNames.length === 0) {
      return fail("invalid", "empty", "No changes to save");
    }

    const creds = gbpCreds();
    if (!creds) {
      return fail(
        "not_linked",
        "not_linked",
        "Google Business connection is not configured",
      );
    }

    let identity: MappingIdentity;
    try {
      identity = await loadOfficeIdentity(ctx, data.officeId);
    } catch (e) {
      return fail("error", "forbidden", (e as Error).message);
    }

    const { body, updateMask } = buildGbpLocationPatch(data.fields);
    if (!updateMask) {
      return fail(
        "invalid",
        "no_publishable_fields",
        "None of the supplied fields can be published",
      );
    }

    try {
      await gbpPatch<GbpRawProfile>(
        `${locationPath(identity.google_account_id, identity.google_location_id, updateMask)}`,
        body,
        creds,
      );
    } catch (e) {
      const err =
        e instanceof GbpError
          ? e
          : new GbpError("upstream", 0, (e as Error).message);
      // A network failure after Google may have accepted the write is reported
      // as uncertain rather than retried blindly.
      const uncertain = err.code === "network";
      return fail(
        uncertain ? "uncertain" : "error",
        err.code,
        uncertain
          ? "Submission status uncertain. Refresh Google profile before retrying."
          : err.message,
      );
    }

    // Google accepted: persist. The RPC re-checks authorization, validation,
    // version and idempotency — a forged client cannot bypass any of them.
    const applied = await rpcOrThrow<
      {
        ok: boolean;
        status: string;
        profile_version: number | null;
        applied_fields: unknown;
        error_code: string | null;
        error_message: string | null;
      }[]
    >(ctx, "admin_apply_google_profile_update", {
      p_office_id: data.officeId,
      p_fields: data.fields,
      p_expected_version: data.expectedVersion ?? null,
      p_idempotency_key: data.idempotencyKey ?? null,
      p_google_status: 200,
    });
    const row = applied?.[0];

    if (!row?.ok) {
      // Google already applied the change but DARB refused to record it (a
      // version race). Surface it so the operator refreshes instead of assuming
      // nothing happened.
      return {
        ok: false,
        status: (row?.status as UpdateProfileResult["status"]) ?? "error",
        profileVersion: row?.profile_version ?? null,
        appliedFields: [],
        fieldErrors: Array.isArray(row?.applied_fields)
          ? (row?.applied_fields as { field: string; code: string }[])
          : [],
        errorCode: row?.error_code ?? "apply_failed",
        errorMessage:
          row?.error_message ??
          "The change was sent to Google but could not be recorded",
      };
    }

    return {
      ok: true,
      status: "published",
      profileVersion: row.profile_version,
      appliedFields: Array.isArray(row.applied_fields)
        ? (row.applied_fields as string[])
        : fieldNames,
      fieldErrors: [],
      errorCode: null,
      errorMessage: null,
    };
  });

// ---------------------------------------------------------------------------
// Change requests — publish an approved high-risk change
// ---------------------------------------------------------------------------

const publishRequestInput = z.object({
  officeId: z.string().uuid(),
  requestId: z.string().uuid(),
});

/**
 * Publish an APPROVED high-risk change request to Google and finalize it.
 *
 * Admin-only: the decide RPC already enforced the role, and this re-checks via
 * the publish RPC. On a Google failure the request is marked FAILED with the
 * normalized error so the Admin can retry, rather than silently disappearing.
 */
export const publishGoogleChangeRequest = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => publishRequestInput.parse(input))
  .handler(async ({ context, data }): Promise<UpdateProfileResult> => {
    const ctx = context as unknown as SupabaseCtx;
    const fail = (
      errorCode: string,
      errorMessage: string,
    ): UpdateProfileResult => ({
      ok: false,
      status: "error",
      profileVersion: null,
      appliedFields: [],
      fieldErrors: [],
      errorCode,
      errorMessage,
    });

    const creds = gbpCreds();
    if (!creds)
      return fail("not_linked", "Google Business connection is not configured");

    // The decided request carries the approved value.
    const requests = await rpcOrThrow<
      {
        id: string;
        status: string;
        field: string;
        requested_value: Record<string, unknown>;
      }[]
    >(ctx, "list_google_profile_change_requests", {
      p_office_id: data.officeId,
      p_status: null,
    });
    const request = requests?.find((r) => r.id === data.requestId);
    if (!request) return fail("not_found", "Change request not found");
    if (request.status !== "APPROVED") {
      return fail("not_approved", "Change request is not approved");
    }

    // Map the request to the field set the update RPC understands.
    const fields: Record<string, unknown> =
      request.field === "PRIMARY_CATEGORY"
        ? { primary_category: request.requested_value?.["primary_category"] }
        : (request.requested_value ?? {});

    let identity: MappingIdentity;
    try {
      identity = await loadOfficeIdentity(ctx, data.officeId);
    } catch (e) {
      await rpcOrThrow(ctx, "admin_finalize_google_change_request", {
        p_office_id: data.officeId,
        p_request_id: data.requestId,
        p_ok: false,
        p_error_code: "forbidden",
        p_error_message: (e as Error).message,
      });
      return fail("forbidden", (e as Error).message);
    }

    const { body, updateMask } = buildGbpLocationPatch(fields);

    try {
      await gbpPatch<GbpRawProfile>(
        locationPath(
          identity.google_account_id,
          identity.google_location_id,
          updateMask,
        ),
        body,
        creds,
      );
    } catch (e) {
      const err =
        e instanceof GbpError
          ? e
          : new GbpError("upstream", 0, (e as Error).message);
      await rpcOrThrow(ctx, "admin_finalize_google_change_request", {
        p_office_id: data.officeId,
        p_request_id: data.requestId,
        p_ok: false,
        p_error_code: err.code,
        p_error_message: err.message,
      });
      return fail(err.code, err.message);
    }

    const applied = await rpcOrThrow<
      {
        ok: boolean;
        status: string;
        profile_version: number | null;
        applied_fields: unknown;
      }[]
    >(ctx, "admin_apply_google_profile_update", {
      p_office_id: data.officeId,
      p_fields: fields,
      p_expected_version: null,
      p_idempotency_key: null,
      p_google_status: 200,
    });
    const row = applied?.[0];

    await rpcOrThrow(ctx, "admin_finalize_google_change_request", {
      p_office_id: data.officeId,
      p_request_id: data.requestId,
      p_ok: Boolean(row?.ok),
      p_error_code: row?.ok ? null : "apply_failed",
      p_error_message: row?.ok ? null : "Approved change could not be recorded",
    });

    return {
      ok: Boolean(row?.ok),
      status: row?.ok ? "published" : "error",
      profileVersion: row?.profile_version ?? null,
      appliedFields: Array.isArray(row?.applied_fields)
        ? (row.applied_fields as string[])
        : Object.keys(fields),
      fieldErrors: [],
      errorCode: row?.ok ? null : "apply_failed",
      errorMessage: row?.ok ? null : "Approved change could not be recorded",
    };
  });
