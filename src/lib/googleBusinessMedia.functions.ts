import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import {
  buildGbpMediaCreateBody,
  collectAllPages,
  GbpError,
  gbpDelete,
  gbpGet,
  gbpPost,
  gbpUploadBytes,
  GBP_MEDIA_DESCRIPTION_MAX,
  googleMediaCategoryFor,
  mediaItemPath,
  mediaPath,
  mediaStartUploadPath,
  normalizeGbpMedia,
  validateMediaBytes,
  type GbpMediaListResponse,
  type GbpRawMedia,
  type NormalizedGbpMedia,
} from "@/lib/googleBusinessGateway";

/**
 * Phase 7 server functions — Google Business photos (media).
 *
 * Same invariants as Phases 5/6:
 *   * Google tokens live in the connector gateway — DARB never sees them.
 *   * The office's Google identity is resolved server-side, never from the client.
 *   * Google is the source of truth; DARB records a change only AFTER Google
 *     accepted it.
 *   * Every DB change goes through a Phase 7 RPC, so office isolation,
 *     idempotency and the audit trail hold even for a forged payload.
 *
 * Location photos use the BYTE upload path (startUpload -> upload bytes ->
 * Media.Create). Post media is a separate URL-only path in
 * googleBusinessPosts.functions.ts.
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

/**
 * Invokes a service-role-only RPC through the admin client, passing the
 * authenticated actor explicitly so the RPC can still authorize them. The
 * connector is the only party that may assert "Google returned this snapshot".
 */
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

type MappingIdentity = {
  google_account_id: string;
  google_location_id: string;
};

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

/** Decodes a base64 upload payload to bytes without assuming a browser global. */
function decodeBase64(payload: string): Uint8Array {
  const clean = payload.includes(",")
    ? payload.slice(payload.indexOf(",") + 1)
    : payload;
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(clean, "base64"));
  }
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** The staging object path. Office-scoped so storage RLS isolates it. */
function stagingPath(officeId: string, assetId: string, mime: string): string {
  const ext = EXT_BY_MIME[mime] ?? "bin";
  return `${officeId}/${assetId}.${ext}`;
}

// ---------------------------------------------------------------------------
// Sync — Google -> DARB
// ---------------------------------------------------------------------------

export interface SyncMediaResult {
  ok: boolean;
  status: "synced" | "not_linked" | "locked" | "error";
  inserted: number;
  updated: number;
  markedNotFound: number;
  errorCode: string | null;
  errorMessage: string | null;
}

const syncInput = z.object({ officeId: z.string().uuid() });

/**
 * Pull every media item for the office's mapped location and cache it.
 *
 * Google's media endpoint returns business media; the normalizer preserves the
 * customer-media marker when Google sends it, so customer photos are never
 * silently claimed as business-owned.
 */
export async function runGoogleMediaSync(
  ctx: SupabaseCtx,
  officeId: string,
): Promise<SyncMediaResult> {
    const empty = { inserted: 0, updated: 0, markedNotFound: 0 };

    const acquired = await rpcOrThrow<boolean>(
      ctx,
      "acquire_google_media_sync_lock",
      { p_office_id: officeId, p_stale_after_seconds: 120 },
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
      await rpcOrThrow(ctx, "admin_mark_google_media_sync_error", {
        p_office_id: officeId,
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
      const identity = await loadOfficeIdentity(ctx, officeId);

      const { items: raw, complete } = await collectAllPages<GbpRawMedia>(
        async (pageToken) => {
          const res = await gbpGet<GbpMediaListResponse>(
            mediaPath(
              identity.google_account_id,
              identity.google_location_id,
              pageToken,
            ),
            creds,
          );
          return {
            items: res.mediaItems ?? [],
            nextPageToken: res.nextPageToken,
          };
        },
      );

      const normalized: NormalizedGbpMedia[] = [];
      for (const item of raw) {
        const row = normalizeGbpMedia(item, {
          locationId: identity.google_location_id,
        });
        if (row) normalized.push(row);
      }

      const applied = await adminRpcOrThrow<
        { inserted: number; updated: number; marked_not_found: number }[]
      >("admin_sync_google_media", {
        p_office_id: officeId,
        p_media: normalized,
        // An incomplete walk must not mark anything NOT_FOUND.
        p_complete: complete,
        p_actor_user_id: ctx.userId,
      });
      const counts = applied?.[0];
      return {
        ok: true,
        status: "synced",
        inserted: counts?.inserted ?? 0,
        updated: counts?.updated ?? 0,
        markedNotFound: counts?.marked_not_found ?? 0,
        errorCode: null,
        errorMessage: null,
      };
    } catch (e) {
      const err =
        e instanceof GbpError
          ? e
          : new GbpError("upstream", 0, (e as Error).message);
      console.error(`Google media sync failed [${err.status}]: ${err.message}`);
      try {
        await rpcOrThrow(ctx, "admin_mark_google_media_sync_error", {
          p_office_id: officeId,
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
}

export const syncGoogleMedia = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => syncInput.parse(input))
  .handler(async ({ context, data }): Promise<SyncMediaResult> =>
    runGoogleMediaSync(context as unknown as SupabaseCtx, data.officeId),
  );

// ---------------------------------------------------------------------------
// Upload — DARB -> Google (byte upload)
// ---------------------------------------------------------------------------

export interface UploadMediaResult {
  ok: boolean;
  status:
    | "published"
    | "duplicate"
    | "in_progress"
    | "invalid"
    | "not_linked"
    | "uncertain"
    | "error";
  mediaId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

const uploadInput = z.object({
  officeId: z.string().uuid(),
  /**
   * Base64 (optionally a data: URL). The server sniffs the real bytes. The
   * length is bounded BEFORE decoding so an oversized payload is rejected by the
   * schema instead of being expanded into memory first: 14,000,000 base64 chars
   * decodes to ~10.5 MB, just above the 10 MB byte limit that `validateMediaBytes`
   * then enforces on the real bytes.
   */
  dataBase64: z.string().min(16).max(14_000_000),
  declaredMime: z.string().min(3).max(100).optional(),
  darbCategory: z
    .enum(["cover", "logo", "exterior", "interior", "team", "other"])
    .default("other"),
  description: z.string().max(GBP_MEDIA_DESCRIPTION_MAX).nullable().optional(),
  uploadOperationId: z.string().min(8).max(200),
});

/**
 * Upload one photo to Google via the byte path.
 *
 * Ordering: validate bytes -> reserve the operation -> stage -> startUpload ->
 * upload bytes -> Media.Create -> record. DARB only stores the media row after
 * Google accepted it, so a failed upload leaves nothing half-published and a
 * double tap returns the first result (the operation receipt).
 */
export const uploadGoogleMedia = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => uploadInput.parse(input))
  .handler(async ({ context, data }): Promise<UploadMediaResult> => {
    const ctx = context as unknown as SupabaseCtx;
    const fail = (
      status: UploadMediaResult["status"],
      errorCode: string,
      errorMessage: string,
    ): UploadMediaResult => ({
      ok: false,
      status,
      mediaId: null,
      errorCode,
      errorMessage,
    });

    // 1. Validate the ACTUAL bytes — never the filename or browser MIME.
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(data.dataBase64);
    } catch {
      return fail("invalid", "bad_payload", "The image could not be read");
    }
    const check = validateMediaBytes(bytes, data.declaredMime);
    if (check.code) {
      return fail("invalid", check.code, "The file is not a supported image");
    }
    const mime = check.mime!;

    const creds = gbpCreds();
    if (!creds) {
      return fail(
        "not_linked",
        "not_linked",
        "Google Business connection is not configured",
      );
    }

    // 2. Reserve the operation BEFORE talking to Google (double-tap guard).
    const begin = await rpcOrThrow<{ status: string; media: unknown }[]>(
      ctx,
      "begin_google_media_upload",
      {
        p_office_id: data.officeId,
        p_operation_id: data.uploadOperationId,
        p_request_hash: `${data.darbCategory}:${bytes.length}`,
      },
    );
    const beginRow = begin?.[0];
    if (beginRow?.status === "published") {
      const prior = beginRow.media as { id?: string } | null;
      return {
        ok: true,
        status: "duplicate",
        mediaId: prior?.id ?? null,
        errorCode: null,
        errorMessage: null,
      };
    }
    if (beginRow?.status === "in_progress") {
      return fail(
        "in_progress",
        "in_progress",
        "This photo is already uploading",
      );
    }

    // 3. Resolve the office identity server-side (never trust a client location).
    let identity: MappingIdentity;
    try {
      identity = await loadOfficeIdentity(ctx, data.officeId);
    } catch (e) {
      await rpcOrThrow(ctx, "fail_google_media_upload", {
        p_office_id: data.officeId,
        p_operation_id: data.uploadOperationId,
        p_error_code: "forbidden",
        p_error_message: (e as Error).message,
      });
      return fail("error", "forbidden", (e as Error).message);
    }

    // 4. Stage the bytes in DARB storage so the original is retained even if
    //    Google fails. Best-effort: a staging failure must not block Google.
    const assetId = crypto.randomUUID();
    const objectPath = stagingPath(data.officeId, assetId, mime);
    try {
      const { supabaseAdmin } =
        await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage
        .from("google-business")
        .upload(objectPath, bytes, { contentType: mime, upsert: false });
    } catch (e) {
      console.warn("media staging skipped:", (e as Error).message);
    }

    // 5. Google byte upload: startUpload -> upload bytes -> Media.Create.
    let googleMedia: GbpRawMedia | undefined;
    try {
      const start = await gbpPost<{ resourceName?: string }>(
        mediaStartUploadPath(
          identity.google_account_id,
          identity.google_location_id,
        ),
        {},
        creds,
      );
      const resourceName = start?.resourceName;
      if (!resourceName)
        throw new Error("Google did not return an upload session");

      await gbpUploadBytes<unknown>(`/${resourceName}`, bytes, mime, creds);

      googleMedia = await gbpPost<GbpRawMedia>(
        mediaPath(
          identity.google_account_id,
          identity.google_location_id,
        ).split("?")[0],
        buildGbpMediaCreateBody({
          googleCategory: googleMediaCategoryFor(data.darbCategory),
          description: data.description ?? null,
          dataRefResourceName: resourceName,
        }),
        creds,
      );
    } catch (e) {
      const err =
        e instanceof GbpError
          ? e
          : new GbpError("upstream", 0, (e as Error).message);
      console.error(
        `Google media upload failed [${err.status}]: ${err.message}`,
      );
      await rpcOrThrow(ctx, "fail_google_media_upload", {
        p_office_id: data.officeId,
        p_operation_id: data.uploadOperationId,
        p_error_code: err.code,
        p_error_message: err.message,
      });
      // A network failure after Google may have accepted the bytes is reported
      // as uncertain rather than retried blindly.
      return fail(
        err.code === "network" ? "uncertain" : "error",
        err.code,
        err.code === "network"
          ? "Upload status uncertain. Refresh media before retrying."
          : err.message,
      );
    }

    const normalized = normalizeGbpMedia(
      { ...(googleMedia ?? {}), name: googleMedia?.name },
      { locationId: identity.google_location_id },
    );
    if (!normalized) {
      await rpcOrThrow(ctx, "fail_google_media_upload", {
        p_office_id: data.officeId,
        p_operation_id: data.uploadOperationId,
        p_error_code: "bad_response",
        p_error_message: "Google accepted the upload but returned no media id",
      });
      return fail(
        "error",
        "bad_response",
        "Google returned an unusable media id",
      );
    }

    // DARB's friendly category is stored alongside Google's; only the mapped
    // Google category was sent to Google.
    const payload = {
      ...normalized,
      darb_category: data.darbCategory,
      description: data.description ?? normalized.description,
      storage_path: objectPath,
    };

    const recorded = await adminRpcOrThrow<
      { media_id: string; media_state: string }[]
    >("record_google_media_upload", {
      p_office_id: data.officeId,
      p_operation_id: data.uploadOperationId,
      p_media: payload,
      p_actor_user_id: ctx.userId,
    });

    return {
      ok: true,
      status: "published",
      mediaId: recorded?.[0]?.media_id ?? null,
      errorCode: null,
      errorMessage: null,
    };
  });

// ---------------------------------------------------------------------------
// Delete — DARB -> Google (business media only)
// ---------------------------------------------------------------------------

export interface DeleteMediaResult {
  ok: boolean;
  status: "deleted" | "not_linked" | "forbidden" | "uncertain" | "error";
  errorCode: string | null;
  errorMessage: string | null;
}

const deleteInput = z.object({
  officeId: z.string().uuid(),
  mediaId: z.string().uuid(),
});

/**
 * Delete a business photo from Google, then mark it deleted in DARB.
 *
 * Ownership is resolved by the RPC before Google is contacted: a cross-office
 * media id, a customer photo, or an unknown id is rejected first.
 */
export const deleteGoogleMedia = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => deleteInput.parse(input))
  .handler(async ({ context, data }): Promise<DeleteMediaResult> => {
    const ctx = context as unknown as SupabaseCtx;
    const fail = (
      status: DeleteMediaResult["status"],
      errorCode: string,
      errorMessage: string,
    ): DeleteMediaResult => ({ ok: false, status, errorCode, errorMessage });

    const creds = gbpCreds();
    if (!creds)
      return fail(
        "not_linked",
        "not_linked",
        "Google Business connection is not configured",
      );

    let media: {
      google_account_id: string;
      google_location_id: string;
      google_media_id: string;
      media_origin: string;
    };
    try {
      const rows = await rpcOrThrow<(typeof media)[]>(
        ctx,
        "resolve_google_media_office",
        { p_office_id: data.officeId, p_media_id: data.mediaId },
      );
      const row = rows?.[0];
      if (!row) return fail("forbidden", "not_found", "Photo not found");
      media = row;
    } catch (e) {
      return fail("forbidden", "forbidden", (e as Error).message);
    }

    if (media.media_origin === "CUSTOMER") {
      return fail(
        "forbidden",
        "customer_media",
        "Customer photos cannot be deleted from DARB",
      );
    }

    try {
      await gbpDelete<unknown>(
        mediaItemPath(
          media.google_account_id,
          media.google_location_id,
          media.google_media_id,
        ),
        creds,
      );
    } catch (e) {
      const err =
        e instanceof GbpError
          ? e
          : new GbpError("upstream", 0, (e as Error).message);
      // 404 means Google already has no such media: converge instead of failing.
      if (err.status === 404) {
        await adminRpcOrThrow("admin_mark_google_media_deleted", {
          p_office_id: data.officeId,
          p_media_id: data.mediaId,
          p_google_status: 404,
          p_actor_user_id: ctx.userId,
        });
        return {
          ok: true,
          status: "deleted",
          errorCode: null,
          errorMessage: null,
        };
      }
      return fail(
        err.code === "network" ? "uncertain" : "error",
        err.code,
        err.code === "network"
          ? "Deletion status uncertain. Refresh media before retrying."
          : err.message,
      );
    }

    await adminRpcOrThrow("admin_mark_google_media_deleted", {
      p_office_id: data.officeId,
      p_media_id: data.mediaId,
      p_google_status: 200,
      p_actor_user_id: ctx.userId,
    });
    return { ok: true, status: "deleted", errorCode: null, errorMessage: null };
  });
