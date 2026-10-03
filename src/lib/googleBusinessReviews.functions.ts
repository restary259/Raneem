import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import {
  collectAllPages,
  GbpError,
  gbpDelete,
  gbpGet,
  gbpPut,
  normalizeGbpReview,
  replyByteLength,
  reviewReplyPath,
  reviewsPath,
  type GbpRawReview,
  type GbpReviewsListResponse,
  type NormalizedGbpReview,
} from "@/lib/googleBusinessGateway";
import { assertGoogleWriteAllowed } from "@/lib/googleBusinessWriteGate";

/**
 * Phase 5 server functions: synchronize Google reviews into the DARB cache and
 * perform the reply write path.
 *
 * The Google tokens live in the connector gateway — DARB never sees them. Every
 * database change goes through a Phase 5 RPC so office isolation, the 4096-byte
 * limit and the audit trail hold even if a caller forges the payload.
 *
 * Ordering matters: DARB only marks a review replied AFTER Google confirms the
 * write. A Google failure leaves the cache untouched so the operator keeps their
 * draft and sees a real error.
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

/** The office's Google identity, resolved server-side (never from the client). */
type MappingIdentity = {
  google_account_id: string;
  google_location_id: string;
  google_location_resource_name: string;
};

type ResolvedReview = {
  review_id: string;
  office_id: string;
  google_account_id: string;
  google_location_id: string;
  google_review_id: string;
  google_review_resource_name: string;
  reply_comment: string | null;
  darb_reply_status: string;
};

/**
 * Resolves the office's mapped location through the ownership RPC. The RPC
 * raises if the caller has no access, so an unauthorized caller never reaches
 * Google.
 */
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

/** Resolves a DARB review id to its Google identity, rejecting cross-office ids. */
async function loadReview(
  ctx: SupabaseCtx,
  officeId: string,
  reviewId: string,
): Promise<ResolvedReview> {
  const rows = await rpcOrThrow<ResolvedReview[]>(
    ctx,
    "resolve_google_review_office",
    { p_office_id: officeId, p_review_id: reviewId },
  );
  const row = rows?.[0];
  if (!row) throw new Error("Review not found");
  return row;
}

export interface SyncReviewsResult {
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
 * Pull every review for the office's mapped location and cache it.
 *
 * A sync lock (advisory, self-expiring) keeps concurrent syncs from stampeding
 * the Google API. The lock is always released — on success by the sync RPC, on
 * failure by the error RPC — so a crashed sync cannot wedge the office.
 */
export async function runGoogleReviewsSync(
  ctx: SupabaseCtx,
  officeId: string,
): Promise<SyncReviewsResult> {
    const empty = { inserted: 0, updated: 0, markedNotFound: 0 };

    // Acquire the lock first: a second concurrent sync must not call Google.
    const acquired = await rpcOrThrow<boolean>(
      ctx,
      "acquire_google_review_sync_lock",
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
      await rpcOrThrow(ctx, "admin_mark_google_review_sync_error", {
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

      let averageRating: number | null = null;
      let totalCount: number | null = null;
      const normalized: NormalizedGbpReview[] = [];

      const { items: raw, complete } = await collectAllPages<GbpRawReview>(
        async (pageToken) => {
          const res = await gbpGet<GbpReviewsListResponse>(
            reviewsPath(
              identity.google_account_id,
              identity.google_location_id,
              pageToken,
            ),
            creds,
          );
          // The summary is authoritative on the first page; keep the first value.
          if (averageRating === null && typeof res.averageRating === "number") {
            averageRating = res.averageRating;
          }
          if (totalCount === null && typeof res.totalReviewCount === "number") {
            totalCount = res.totalReviewCount;
          }
          return { items: res.reviews ?? [], nextPageToken: res.nextPageToken };
        },
      );

      for (const item of raw) {
        const row = normalizeGbpReview(item, {
          accountId: identity.google_account_id,
          locationId: identity.google_location_id,
        });
        if (row) normalized.push(row);
      }

      const applied = await adminRpcOrThrow<
        { inserted: number; updated: number; marked_not_found: number }[]
      >("admin_sync_google_reviews", {
        p_office_id: officeId,
        p_reviews: normalized,
        p_average_rating: averageRating,
        p_total_count: totalCount,
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
      console.error(
        `Google review sync failed [${err.status}]: ${err.message}`,
      );
      // Record the failure and release the lock in a separate transaction; the
      // cached reviews are left exactly as they were.
      try {
        await rpcOrThrow(ctx, "admin_mark_google_review_sync_error", {
          p_office_id: officeId,
          p_error_code: err.code,
          p_error_message: err.message,
        });
      } catch {
        /* best effort — still release below */
      }
      try {
        await rpcOrThrow(ctx, "release_google_review_sync_lock", {
          p_office_id: officeId,
        });
      } catch {
        /* the stale window will reclaim it */
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

export const syncGoogleReviews = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => syncInput.parse(input))
  .handler(async ({ context, data }): Promise<SyncReviewsResult> =>
    runGoogleReviewsSync(context as unknown as SupabaseCtx, data.officeId),
  );

// ---------------------------------------------------------------------------
// Reply write path
// ---------------------------------------------------------------------------

export interface ReplyResult {
  ok: boolean;
  status:
    | "published"
    | "pending"
    | "rejected"
    | "not_linked"
    | "invalid"
    | "uncertain"
    | "error";
  darbReplyStatus: string | null;
  replyComment: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

const publishInput = z.object({
  officeId: z.string().uuid(),
  reviewId: z.string().uuid(),
  comment: z.string().min(1).max(20000),
});

const deleteInput = z.object({
  officeId: z.string().uuid(),
  reviewId: z.string().uuid(),
});

/** Google's reply resource uses a coarse state; map it to a DARB status. */
function replyStateOf(reply: { state?: string } | undefined): string | null {
  const state = reply?.state?.toUpperCase();
  if (!state) return null;
  return state;
}

/**
 * Create or update the public reply for a review.
 *
 * The DB stores the reply only after Google accepts. When Google reports a
 * policy violation the text is kept and the review is marked REPLY_REJECTED so
 * the operator can edit and retry — never presented as published.
 */
export const publishGoogleReviewReply = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => publishInput.parse(input))
  .handler(async ({ context, data }): Promise<ReplyResult> => {
    const ctx = context as unknown as SupabaseCtx;

    // Validate the byte limit before anything else: Google counts bytes, and a
    // browser-side check alone is not a security boundary.
    if (replyByteLength(data.comment) > 4096) {
      return {
        ok: false,
        status: "invalid",
        darbReplyStatus: null,
        replyComment: null,
        errorCode: "too_long",
        errorMessage: "Reply exceeds Google's 4096-byte limit",
      };
    }

    const creds = gbpCreds();
    if (!creds) {
      return {
        ok: false,
        status: "not_linked",
        darbReplyStatus: null,
        replyComment: null,
        errorCode: "not_linked",
        errorMessage: "Google Business connection is not configured",
      };
    }

    let review: ResolvedReview;
    try {
      // Pre-flight WRITE gate: refuse before touching Google when the write
      // kill switch is off, so no mutation can happen behind a VIEW-only read.
      await assertGoogleWriteAllowed(ctx, data.officeId, "GOOGLE_REPLY_REVIEW");
      // The ownership RPC raises for a cross-office or unauthorized review, so
      // Google is never contacted for a review the caller may not touch.
      review = await loadReview(ctx, data.officeId, data.reviewId);
    } catch (e) {
      return {
        ok: false,
        status: "error",
        darbReplyStatus: null,
        replyComment: null,
        errorCode: "forbidden",
        errorMessage: (e as Error).message,
      };
    }

    const isEdit = Boolean(review.reply_comment);
    const action = isEdit ? "UPDATED" : "CREATED";

    let googleReply:
      | { comment?: string; state?: string; policyViolation?: string }
      | undefined;
    try {
      googleReply = await gbpPut<{
        comment?: string;
        state?: string;
        policyViolation?: string;
      }>(
        reviewReplyPath(
          review.google_account_id,
          review.google_location_id,
          review.google_review_id,
        ),
        { comment: data.comment },
        creds,
      );
    } catch (e) {
      const err =
        e instanceof GbpError
          ? e
          : new GbpError("upstream", 0, (e as Error).message);
      // A network failure after Google may have accepted the write is NOT
      // retried blindly: DARB reports uncertainty and asks the operator to
      // refresh rather than risk a duplicate submission.
      const uncertain = err.code === "network";
      return {
        ok: false,
        status: uncertain ? "uncertain" : "error",
        darbReplyStatus: null,
        replyComment: null,
        errorCode: err.code,
        errorMessage: uncertain
          ? "Submission status uncertain. Refresh Google review status before retrying."
          : err.message,
      };
    }

    const googleState = replyStateOf(googleReply);
    const policyViolation = googleReply?.policyViolation ?? null;

    const applied = await rpcOrThrow<
      { darb_reply_status: string; reply_comment: string | null }[]
    >(ctx, "admin_apply_google_review_reply", {
      p_office_id: data.officeId,
      p_review_id: data.reviewId,
      p_action: action,
      p_reply_comment: data.comment,
      p_google_reply_state: googleState,
      p_policy_violation: policyViolation,
      p_google_status: 200,
    });
    const row = applied?.[0];

    const status: ReplyResult["status"] =
      row?.darb_reply_status === "REPLY_REJECTED"
        ? "rejected"
        : row?.darb_reply_status === "REPLY_PENDING"
          ? "pending"
          : "published";

    return {
      ok: true,
      status,
      darbReplyStatus: row?.darb_reply_status ?? null,
      replyComment: row?.reply_comment ?? null,
      errorCode: null,
      errorMessage: null,
    };
  });

/** Delete the public reply. Only the DB is updated after Google confirms. */
export const deleteGoogleReviewReply = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => deleteInput.parse(input))
  .handler(async ({ context, data }): Promise<ReplyResult> => {
    const ctx = context as unknown as SupabaseCtx;

    const creds = gbpCreds();
    if (!creds) {
      return {
        ok: false,
        status: "not_linked",
        darbReplyStatus: null,
        replyComment: null,
        errorCode: "not_linked",
        errorMessage: "Google Business connection is not configured",
      };
    }

    let review: ResolvedReview;
    try {
      await assertGoogleWriteAllowed(ctx, data.officeId, "GOOGLE_REPLY_REVIEW");
      review = await loadReview(ctx, data.officeId, data.reviewId);
    } catch (e) {
      return {
        ok: false,
        status: "error",
        darbReplyStatus: null,
        replyComment: null,
        errorCode: "forbidden",
        errorMessage: (e as Error).message,
      };
    }

    try {
      await gbpDelete<unknown>(
        reviewReplyPath(
          review.google_account_id,
          review.google_location_id,
          review.google_review_id,
        ),
        creds,
      );
    } catch (e) {
      const err =
        e instanceof GbpError
          ? e
          : new GbpError("upstream", 0, (e as Error).message);
      // Google returns 404 when there was no reply to delete — treat that as
      // already-deleted so the cache converges instead of showing a dead action.
      if (err.status === 404) {
        await rpcOrThrow(ctx, "admin_apply_google_review_reply", {
          p_office_id: data.officeId,
          p_review_id: data.reviewId,
          p_action: "DELETED",
          p_google_status: 404,
        });
        return {
          ok: true,
          status: "published",
          darbReplyStatus: "UNANSWERED",
          replyComment: null,
          errorCode: null,
          errorMessage: null,
        };
      }
      const uncertain = err.code === "network";
      return {
        ok: false,
        status: uncertain ? "uncertain" : "error",
        darbReplyStatus: null,
        replyComment: null,
        errorCode: err.code,
        errorMessage: uncertain
          ? "Submission status uncertain. Refresh Google review status before retrying."
          : err.message,
      };
    }

    const applied = await rpcOrThrow<
      { darb_reply_status: string; reply_comment: string | null }[]
    >(ctx, "admin_apply_google_review_reply", {
      p_office_id: data.officeId,
      p_review_id: data.reviewId,
      p_action: "DELETED",
      p_google_status: 200,
    });
    return {
      ok: true,
      status: "published",
      darbReplyStatus: applied?.[0]?.darb_reply_status ?? "UNANSWERED",
      replyComment: null,
      errorCode: null,
      errorMessage: null,
    };
  });
