import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import {
  buildGbpPostBody,
  collectAllPages,
  GbpError,
  gbpDelete,
  gbpGet,
  gbpPatch,
  gbpPost,
  normalizeGbpPost,
  postCreatePath,
  postItemPath,
  postsPath,
  type GbpPostsListResponse,
  type GbpPostDraft,
  type GbpPostCtaType,
  type GbpPostTopicType,
  type GbpRawPost,
  type NormalizedGbpPost,
} from "@/lib/googleBusinessGateway";

/**
 * Phase 7 server functions — Google Local Posts.
 *
 * Google requires a URL for media embedded in a Local Post (unlike location
 * photos, which may be byte-uploaded). DARB therefore resolves each attached
 * media id to the Google-hosted URL it already holds — the two-path split the
 * phase calls for.
 *
 * Publishing is a transaction: local draft -> Google create/patch -> SUCCESS ->
 * store the Google id -> status PUBLISHED. A Google failure keeps the draft and
 * marks it FAILED, never a false PUBLISHED.
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

type ResolvedPost = {
  post_id: string;
  office_id: string;
  google_account_id: string | null;
  google_location_id: string | null;
  google_post_id: string | null;
  status: string;
  version: number;
  topic_type: string;
  language_code: string;
  summary: string | null;
  cta_type: string | null;
  cta_url: string | null;
  event_title: string | null;
  event_start: string | null;
  event_end: string | null;
  offer_coupon_code: string | null;
  offer_url: string | null;
  offer_terms: string | null;
  media_ids: string[];
  media_urls: string[];
};

async function loadPost(
  ctx: SupabaseCtx,
  officeId: string,
  postId: string,
): Promise<ResolvedPost> {
  const rows = await rpcOrThrow<ResolvedPost[]>(
    ctx,
    "resolve_google_post_office",
    { p_office_id: officeId, p_post_id: postId },
  );
  const row = rows?.[0];
  if (!row) throw new Error("Post not found");
  return row;
}

const postDraftSchema = z.object({
  topic_type: z.enum(["STANDARD", "EVENT", "OFFER"]),
  language_code: z.string().min(2).max(20),
  summary: z.string().max(1500),
  cta_type: z
    .enum(["LEARN_MORE", "SIGN_UP", "BOOK", "CALL", "ORDER", "SHOP"])
    .nullable()
    .optional(),
  cta_url: z.string().max(2000).nullable().optional(),
  event_title: z.string().max(200).nullable().optional(),
  event_start: z.string().max(40).nullable().optional(),
  event_end: z.string().max(40).nullable().optional(),
  offer_coupon_code: z.string().max(100).nullable().optional(),
  offer_url: z.string().max(2000).nullable().optional(),
  offer_terms: z.string().max(500).nullable().optional(),
  media_ids: z.array(z.string().uuid()).max(1).default([]),
});

/** The DARB draft shape the RPCs and gateway expect. */
function toDraft(input: z.infer<typeof postDraftSchema>): GbpPostDraft {
  return {
    topic_type: input.topic_type as GbpPostTopicType,
    language_code: input.language_code,
    summary: input.summary,
    cta_type: (input.cta_type ?? null) as GbpPostCtaType | null,
    cta_url: input.cta_url ?? null,
    event_title: input.event_title ?? null,
    event_start: input.event_start ?? null,
    event_end: input.event_end ?? null,
    offer_coupon_code: input.offer_coupon_code ?? null,
    offer_url: input.offer_url ?? null,
    offer_terms: input.offer_terms ?? null,
    media_ids: input.media_ids,
  };
}

// ---------------------------------------------------------------------------
// Sync — Google -> DARB
// ---------------------------------------------------------------------------

export interface SyncPostsResult {
  ok: boolean;
  status: "synced" | "not_linked" | "locked" | "error";
  inserted: number;
  updated: number;
  markedDeleted: number;
  errorCode: string | null;
  errorMessage: string | null;
}

const syncInput = z.object({ officeId: z.string().uuid() });

/**
 * Pull every Local Post for the office's mapped location and cache it.
 * Posts Google no longer returns are marked DELETED_EXTERNALLY, never left
 * reading PUBLISHED forever.
 */
export const syncGooglePosts = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => syncInput.parse(input))
  .handler(async ({ context, data }): Promise<SyncPostsResult> => {
    const ctx = context as unknown as SupabaseCtx;
    const empty = { inserted: 0, updated: 0, markedDeleted: 0 };

    const acquired = await rpcOrThrow<boolean>(
      ctx,
      "acquire_google_posts_sync_lock",
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
      await rpcOrThrow(ctx, "admin_mark_google_posts_sync_error", {
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

      const raw = await collectAllPages<GbpRawPost>(async (pageToken) => {
        const res = await gbpGet<GbpPostsListResponse>(
          postsPath(
            identity.google_account_id,
            identity.google_location_id,
            pageToken,
          ),
          creds,
        );
        return {
          items: res.localPosts ?? [],
          nextPageToken: res.nextPageToken,
        };
      });

      const normalized: NormalizedGbpPost[] = [];
      for (const item of raw) {
        const row = normalizeGbpPost(item);
        if (row) normalized.push(row);
      }

      const applied = await rpcOrThrow<
        { inserted: number; updated: number; marked_deleted: number }[]
      >(ctx, "admin_sync_google_posts", {
        p_office_id: data.officeId,
        p_posts: normalized,
      });
      const counts = applied?.[0];
      return {
        ok: true,
        status: "synced",
        inserted: counts?.inserted ?? 0,
        updated: counts?.updated ?? 0,
        markedDeleted: counts?.marked_deleted ?? 0,
        errorCode: null,
        errorMessage: null,
      };
    } catch (e) {
      const err =
        e instanceof GbpError
          ? e
          : new GbpError("upstream", 0, (e as Error).message);
      console.error(`Google posts sync failed [${err.status}]: ${err.message}`);
      try {
        await rpcOrThrow(ctx, "admin_mark_google_posts_sync_error", {
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
// Draft create / update
// ---------------------------------------------------------------------------

export interface SavePostResult {
  ok: boolean;
  status: "saved" | "conflict" | "invalid" | "forbidden" | "error";
  postId: string | null;
  version: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

const createDraftInput = z.object({
  officeId: z.string().uuid(),
  post: postDraftSchema,
});

/** Create a DARB draft. Never touches Google. */
export const createGooglePostDraft = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => createDraftInput.parse(input))
  .handler(async ({ context, data }): Promise<SavePostResult> => {
    const ctx = context as unknown as SupabaseCtx;
    try {
      const rows = await rpcOrThrow<
        { post_id: string; status: string; version: number }[]
      >(ctx, "create_google_post_draft", {
        p_office_id: data.officeId,
        p_post: toDraft(data.post),
      });
      const row = rows?.[0];
      return {
        ok: true,
        status: "saved",
        postId: row?.post_id ?? null,
        version: row?.version ?? 1,
        errorCode: null,
        errorMessage: null,
      };
    } catch (e) {
      const message = (e as Error).message || "Could not save the draft";
      const invalid = /Invalid post|invalid_parameter_value/i.test(message);
      return {
        ok: false,
        status: invalid ? "invalid" : "error",
        postId: null,
        version: null,
        errorCode: invalid ? "invalid" : "error",
        errorMessage: message,
      };
    }
  });

const updateDraftInput = z.object({
  officeId: z.string().uuid(),
  postId: z.string().uuid(),
  post: postDraftSchema,
  expectedVersion: z.number().int().positive().nullable().optional(),
});

/** Update a DARB draft (or a published post's stored content) with concurrency. */
export const updateGooglePostDraft = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => updateDraftInput.parse(input))
  .handler(async ({ context, data }): Promise<SavePostResult> => {
    const ctx = context as unknown as SupabaseCtx;
    try {
      const rows = await rpcOrThrow<
        { post_id: string; status: string; version: number }[]
      >(ctx, "update_google_post_draft", {
        p_office_id: data.officeId,
        p_post_id: data.postId,
        p_post: toDraft(data.post),
        p_expected_version: data.expectedVersion ?? null,
      });
      const row = rows?.[0];
      return {
        ok: true,
        status: "saved",
        postId: row?.post_id ?? data.postId,
        version: row?.version ?? null,
        errorCode: null,
        errorMessage: null,
      };
    } catch (e) {
      const message = (e as Error).message || "Could not save the post";
      const conflict = /serialization_failure|modified by someone else/i.test(
        message,
      );
      const invalid = /Invalid post|invalid_parameter_value/i.test(message);
      const forbidden =
        /Forbidden|insufficient_privilege|does not belong/i.test(message);
      return {
        ok: false,
        status: conflict
          ? "conflict"
          : invalid
            ? "invalid"
            : forbidden
              ? "forbidden"
              : "error",
        postId: data.postId,
        version: null,
        errorCode: conflict
          ? "conflict"
          : invalid
            ? "invalid"
            : forbidden
              ? "forbidden"
              : "error",
        errorMessage: conflict
          ? "This post was changed by someone else. Reload before saving."
          : message,
      };
    }
  });

// ---------------------------------------------------------------------------
// Publish — DARB -> Google
// ---------------------------------------------------------------------------

export interface PublishPostResult {
  ok: boolean;
  status:
    | "published"
    | "duplicate"
    | "locked"
    | "invalid"
    | "not_linked"
    | "uncertain"
    | "error";
  googlePostId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

const publishInput = z.object({
  officeId: z.string().uuid(),
  postId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(200),
});

/**
 * Publish a draft to Google.
 *
 * The operation is idempotent: the same key returns the first result instead of
 * creating a second post. The publish lock is held across the Google call, and
 * a Google failure marks the draft FAILED while retaining it.
 */
export const publishGooglePost = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => publishInput.parse(input))
  .handler(async ({ context, data }): Promise<PublishPostResult> => {
    const ctx = context as unknown as SupabaseCtx;
    const fail = (
      status: PublishPostResult["status"],
      errorCode: string,
      errorMessage: string,
    ): PublishPostResult => ({
      ok: false,
      status,
      googlePostId: null,
      errorCode,
      errorMessage,
    });

    // Idempotency first: a replay must not reach Google at all.
    const prior = await rpcOrThrow<{ found: boolean; result: unknown }[]>(
      ctx,
      "check_google_post_operation",
      {
        p_office_id: data.officeId,
        p_operation: "PUBLISH",
        p_operation_id: data.idempotencyKey,
      },
    );
    if (prior?.[0]?.found) {
      const result = prior[0].result as { google_post_id?: string } | null;
      return {
        ok: true,
        status: "duplicate",
        googlePostId: result?.google_post_id ?? null,
        errorCode: null,
        errorMessage: null,
      };
    }

    const creds = gbpCreds();
    if (!creds)
      return fail(
        "not_linked",
        "not_linked",
        "Google Business connection is not configured",
      );

    let post: ResolvedPost;
    try {
      post = await loadPost(ctx, data.officeId, data.postId);
    } catch (e) {
      return fail("error", "forbidden", (e as Error).message);
    }

    if (post.status === "DELETED" || post.status === "DELETED_EXTERNALLY") {
      return fail("invalid", "deleted", "A deleted post cannot be published");
    }

    // Validate + resolve the attached media server-side (same office, business
    // media only). This never trusts the browser's media list.
    let mediaUrls: string[] = [];
    try {
      const urls = await rpcOrThrow<string[]>(
        ctx,
        "resolve_google_post_media_urls",
        { p_office_id: data.officeId, p_media_ids: post.media_ids ?? [] },
      );
      mediaUrls = Array.isArray(urls) ? urls.filter(Boolean) : [];
    } catch (e) {
      return fail("invalid", "media_invalid", (e as Error).message);
    }

    const draft: GbpPostDraft = {
      topic_type: post.topic_type as GbpPostTopicType,
      language_code: post.language_code,
      summary: post.summary ?? "",
      cta_type: (post.cta_type ?? null) as GbpPostCtaType | null,
      cta_url: post.cta_url,
      event_title: post.event_title,
      event_start: post.event_start,
      event_end: post.event_end,
      offer_coupon_code: post.offer_coupon_code,
      offer_url: post.offer_url,
      offer_terms: post.offer_terms,
      media_ids: post.media_ids ?? [],
    };

    // Acquire the publish lock (advisory, self-expiring).
    const acquired = await rpcOrThrow<boolean>(
      ctx,
      "acquire_google_post_publish_lock",
      {
        p_office_id: data.officeId,
        p_post_id: data.postId,
        p_operation_id: data.idempotencyKey,
        p_stale_after_seconds: 120,
      },
    );
    if (!acquired)
      return fail("locked", "locked", "This post is already being published");

    let identity: MappingIdentity;
    try {
      identity = await loadOfficeIdentity(ctx, data.officeId);
    } catch (e) {
      await rpcOrThrow(ctx, "release_google_post_publish_lock", {
        p_office_id: data.officeId,
        p_post_id: data.postId,
      });
      return fail("error", "not_mapped", (e as Error).message);
    }

    const body = buildGbpPostBody(draft, mediaUrls);
    const isEdit = Boolean(post.google_post_id);

    let googlePost: GbpRawPost | undefined;
    try {
      googlePost = isEdit
        ? await gbpPatch<GbpRawPost>(
            // Google requires an updateMask on a Local Post PATCH so only the
            // fields DARB actually set are written.
            `${postItemPath(
              identity.google_account_id,
              identity.google_location_id,
              post.google_post_id!,
            )}?updateMask=${encodeURIComponent(
              [
                "languageCode",
                "summary",
                "topicType",
                "callToAction",
                "event",
                "offer",
                "media",
              ]
                .filter((k) => k in body)
                .join(","),
            )}`,
            body,
            creds,
          )
        : await gbpPost<GbpRawPost>(
            postCreatePath(
              identity.google_account_id,
              identity.google_location_id,
            ),
            body,
            creds,
          );
    } catch (e) {
      const err =
        e instanceof GbpError
          ? e
          : new GbpError("upstream", 0, (e as Error).message);
      console.error(
        `Google post publish failed [${err.status}]: ${err.message}`,
      );
      // The draft is retained and marked FAILED; the lock is released.
      await rpcOrThrow(ctx, "admin_mark_google_post_publish_failed", {
        p_office_id: data.officeId,
        p_post_id: data.postId,
        p_error_code: err.code,
        p_error_message: err.message,
      });
      return fail(
        err.code === "network" ? "uncertain" : "error",
        err.code,
        err.code === "network"
          ? "Publish status uncertain. Refresh posts before retrying."
          : err.message,
      );
    }

    const normalized = normalizeGbpPost(googlePost ?? {});
    const googlePostId =
      normalized?.google_post_id ?? post.google_post_id ?? null;
    if (!googlePostId) {
      await rpcOrThrow(ctx, "admin_mark_google_post_publish_failed", {
        p_office_id: data.officeId,
        p_post_id: data.postId,
        p_error_code: "bad_response",
        p_error_message: "Google accepted the post but returned no id",
      });
      return fail(
        "error",
        "bad_response",
        "Google returned an unusable post id",
      );
    }

    const resourceName =
      normalized?.google_post_resource_name ??
      `accounts/${identity.google_account_id}/locations/${identity.google_location_id}/localPosts/${googlePostId}`;

    await rpcOrThrow(ctx, "admin_apply_google_post_publish", {
      p_office_id: data.officeId,
      p_post_id: data.postId,
      p_google_post_id: googlePostId,
      p_google_post_resource_name: resourceName,
      p_google_state: normalized?.google_state ?? null,
      p_operation_id: data.idempotencyKey,
      p_request_hash: `${post.version}`,
      p_media_urls: mediaUrls,
      p_search_url: normalized?.search_url ?? null,
      p_google_update_time: normalized?.google_update_time ?? null,
    });

    return {
      ok: true,
      status: "published",
      googlePostId,
      errorCode: null,
      errorMessage: null,
    };
  });

// ---------------------------------------------------------------------------
// Delete — DARB -> Google
// ---------------------------------------------------------------------------

export interface DeletePostResult {
  ok: boolean;
  status: "deleted" | "not_linked" | "forbidden" | "uncertain" | "error";
  errorCode: string | null;
  errorMessage: string | null;
}

const deleteInput = z.object({
  officeId: z.string().uuid(),
  postId: z.string().uuid(),
});

/**
 * Delete a post. A never-published draft is deleted locally; a published post
 * is removed from Google first, then marked deleted in DARB.
 */
export const deleteGooglePost = createServerFn({ method: "POST" })
  .middleware([attachBearer, requireSupabaseAuth])
  .inputValidator((input) => deleteInput.parse(input))
  .handler(async ({ context, data }): Promise<DeletePostResult> => {
    const ctx = context as unknown as SupabaseCtx;
    const fail = (
      status: DeletePostResult["status"],
      errorCode: string,
      errorMessage: string,
    ): DeletePostResult => ({ ok: false, status, errorCode, errorMessage });

    let post: ResolvedPost;
    try {
      post = await loadPost(ctx, data.officeId, data.postId);
    } catch (e) {
      return fail("forbidden", "forbidden", (e as Error).message);
    }

    // A draft that never reached Google is removed locally — no Google call.
    if (!post.google_post_id) {
      await rpcOrThrow(ctx, "admin_mark_google_post_deleted", {
        p_office_id: data.officeId,
        p_post_id: data.postId,
        p_operation_id: null,
        p_google_status: 200,
      });
      return {
        ok: true,
        status: "deleted",
        errorCode: null,
        errorMessage: null,
      };
    }

    const creds = gbpCreds();
    if (!creds)
      return fail(
        "not_linked",
        "not_linked",
        "Google Business connection is not configured",
      );

    const acquired = await rpcOrThrow<boolean>(
      ctx,
      "acquire_google_post_delete_lock",
      {
        p_office_id: data.officeId,
        p_post_id: data.postId,
        p_stale_after_seconds: 120,
      },
    );
    if (!acquired)
      return fail("error", "locked", "This post is already being deleted");

    let identity: MappingIdentity;
    try {
      identity = await loadOfficeIdentity(ctx, data.officeId);
    } catch (e) {
      await rpcOrThrow(ctx, "release_google_post_delete_lock", {
        p_office_id: data.officeId,
        p_post_id: data.postId,
      });
      return fail("error", "not_mapped", (e as Error).message);
    }

    try {
      await gbpDelete<unknown>(
        postItemPath(
          identity.google_account_id,
          identity.google_location_id,
          post.google_post_id,
        ),
        creds,
      );
    } catch (e) {
      const err =
        e instanceof GbpError
          ? e
          : new GbpError("upstream", 0, (e as Error).message);
      // 404 means Google already has no such post: converge instead of failing.
      if (err.status === 404) {
        await rpcOrThrow(ctx, "admin_mark_google_post_deleted", {
          p_office_id: data.officeId,
          p_post_id: data.postId,
          p_operation_id: null,
          p_google_status: 404,
        });
        return {
          ok: true,
          status: "deleted",
          errorCode: null,
          errorMessage: null,
        };
      }
      await rpcOrThrow(ctx, "release_google_post_delete_lock", {
        p_office_id: data.officeId,
        p_post_id: data.postId,
      });
      return fail(
        err.code === "network" ? "uncertain" : "error",
        err.code,
        err.code === "network"
          ? "Deletion status uncertain. Refresh posts before retrying."
          : err.message,
      );
    }

    await rpcOrThrow(ctx, "admin_mark_google_post_deleted", {
      p_office_id: data.officeId,
      p_post_id: data.postId,
      p_operation_id: null,
      p_google_status: 200,
    });
    return { ok: true, status: "deleted", errorCode: null, errorMessage: null };
  });
