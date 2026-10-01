/**
 * Pure helpers for Google Business Profile gateway calls (no secrets here).
 * Server code passes in fetch + credentials; this keeps retry/error mapping testable.
 */

export const GBP_GATEWAY_URL =
  "https://connector-gateway.lovable.dev/google_business_profile";

export type GbpErrorCode =
  | "not_linked"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "upstream"
  | "network";

export class GbpError extends Error {
  constructor(
    public code: GbpErrorCode,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Maps an HTTP status + provider body to a stable error code. */
export function mapGbpError(status: number, body: string): GbpError {
  let message = body.slice(0, 500);
  try {
    const parsed = JSON.parse(body);
    message = parsed?.error?.message || parsed?.message || message;
  } catch {
    /* non-JSON body */
  }
  const code: GbpErrorCode =
    status === 401
      ? "unauthorized"
      : status === 403
        ? "forbidden"
        : status === 429
          ? "rate_limited"
          : "upstream";
  return new GbpError(code, status, message || `HTTP ${status}`);
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** GET with at most 3 attempts; retries only 429 and 5xx (reads are safe to retry). */
export async function gbpGet<T>(
  path: string,
  creds: { lovableKey: string; connectionKey: string },
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  return gbpRequest<T>("GET", path, creds, undefined, fetchImpl, sleep);
}

/**
 * PUT for a Google write that is idempotent in intent: the review reply update
 * sets the reply to an absolute value, so replaying it converges rather than
 * appending. Retried on 429/5xx for the same reason.
 */
export async function gbpPut<T>(
  path: string,
  body: unknown,
  creds: { lovableKey: string; connectionKey: string },
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  return gbpRequest<T>("PUT", path, creds, body, fetchImpl, sleep);
}

/**
 * DELETE is NOT retried on 5xx. A failed response after Google already applied
 * the delete would make a retry hit a now-missing reply; the caller reconciles
 * with a sync instead. 429 is still retried (nothing was applied).
 */
export async function gbpDelete<T>(
  path: string,
  creds: { lovableKey: string; connectionKey: string },
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  return gbpRequest<T>(
    "DELETE",
    path,
    creds,
    undefined,
    fetchImpl,
    sleep,
    false,
  );
}

async function gbpRequest<T>(
  method: "GET" | "PUT" | "DELETE",
  path: string,
  creds: { lovableKey: string; connectionKey: string },
  body: unknown,
  fetchImpl: FetchLike,
  sleep: (ms: number) => Promise<void>,
  retryServerErrors = true,
): Promise<T> {
  let last: GbpError | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(`${GBP_GATEWAY_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${creds.lovableKey}`,
          "X-Connection-Api-Key": creds.connectionKey,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (e) {
      last = new GbpError("network", 0, (e as Error).message);
      await sleep(250 * 2 ** attempt);
      continue;
    }
    if (res.ok) {
      // 204 (delete) has no body.
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }
    const resBody = await res.text();
    last = mapGbpError(res.status, resBody);
    const retryable =
      res.status === 429 || (retryServerErrors && res.status >= 500);
    if (!retryable || attempt === 2) throw last;
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 250 * 2 ** attempt + Math.random() * 100;
    await sleep(Math.min(wait, 5000));
  }
  throw last ?? new GbpError("upstream", 0, "Unknown error");
}
// ---------------------------------------------------------------------------
// Phase 3 — pure location normalization helpers
//
// Kept here (no secrets) so discovery + mapping are testable without network.
// ---------------------------------------------------------------------------

/** Read mask for discovery: the fields DARB maps and shows, nothing more. */
export const GBP_LOCATION_READ_MASK =
  "name,title,storeCode,phoneNumbers,websiteUri,categories,storefrontAddress,metadata,placeId";

export type GbpRawLocation = {
  name?: string;
  title?: string;
  storeCode?: string;
  phoneNumbers?: { primaryPhone?: string };
  websiteUri?: string;
  categories?: { primaryCategory?: { displayName?: string } };
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  metadata?: { placeId?: string; mapsUri?: string; newReviewUri?: string };
  /** Google returns this on the Location resource; kept for the cache. */
  locationState?: {
    isVerified?: boolean;
    isSuspended?: boolean;
    canModify?: boolean;
  };
};

/** A location as DARB stores it in the cache. `resourceName` is the key. */
export type NormalizedGbpLocation = {
  google_account_id: string;
  google_location_id: string;
  google_location_resource_name: string;
  store_code: string | null;
  location_name: string | null;
  primary_category: string | null;
  address_json: {
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
  };
  phone: string | null;
  website_url: string | null;
  place_id: string | null;
  maps_url: string | null;
  verification_state: string | null;
  location_state: string | null;
  raw_location_json: GbpRawLocation;
};

/** Last path segment of a Google resource name (accounts/x/locations/y -> y). */
export function resourceId(resourceName: string): string {
  const parts = resourceName.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : resourceName;
}

function verificationStateOf(loc: GbpRawLocation): string | null {
  const state = loc.locationState;
  if (!state) return null;
  if (state.isSuspended) return "SUSPENDED";
  if (state.isVerified) return "VERIFIED";
  return "PENDING";
}

/**
 * Google location -> cache row. `accountId` is the caller-verified account, not
 * a value taken from the payload, so a location can never be filed under an
 * account the caller does not control.
 */
export function normalizeGbpLocation(
  accountId: string,
  loc: GbpRawLocation,
): NormalizedGbpLocation | null {
  const resourceName = loc.name?.trim();
  if (!resourceName) return null;
  const addr = loc.storefrontAddress ?? {};
  const lines = addr.addressLines ?? [];
  return {
    google_account_id: accountId,
    google_location_id: resourceId(resourceName),
    google_location_resource_name: resourceName,
    store_code: loc.storeCode?.trim() || null,
    location_name: loc.title?.trim() || null,
    primary_category:
      loc.categories?.primaryCategory?.displayName?.trim() || null,
    address_json: {
      address_line_1: lines[0]?.trim() || null,
      address_line_2: lines[1]?.trim() || null,
      city: addr.locality?.trim() || null,
      postal_code: addr.postalCode?.trim() || null,
      country: addr.regionCode?.trim() || null,
    },
    phone: loc.phoneNumbers?.primaryPhone?.trim() || null,
    website_url: loc.websiteUri?.trim() || null,
    place_id: loc.metadata?.placeId?.trim() || null,
    maps_url: loc.metadata?.mapsUri?.trim() || null,
    verification_state: verificationStateOf(loc),
    location_state: loc.locationState?.isSuspended
      ? "SUSPENDED"
      : loc.locationState
        ? "OPEN"
        : null,
    raw_location_json: loc,
  };
}

/** Human-readable one-line address for the selector. */
export function formatGbpAddress(
  address: NormalizedGbpLocation["address_json"] | null | undefined,
): string | null {
  if (!address) return null;
  const parts = [
    address.address_line_1,
    address.postal_code,
    address.city,
    address.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Walks Google's `nextPageToken` until exhausted. Guards against a provider
 * that keeps handing back the same token, and a hard page ceiling so a
 * misbehaving API cannot loop forever.
 */
export async function collectAllPages<T>(
  fetchPage: (
    pageToken: string | undefined,
  ) => Promise<{ items: T[]; nextPageToken?: string }>,
  maxPages = 20,
): Promise<T[]> {
  const out: T[] = [];
  const seen = new Set<string>();
  let token: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const { items, nextPageToken } = await fetchPage(token);
    out.push(...items);
    if (!nextPageToken || seen.has(nextPageToken)) break;
    seen.add(nextPageToken);
    token = nextPageToken;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Phase 5 — pure review helpers
//
// Google's review listing is a separate v4 endpoint from the v1 Business
// Information API. The gateway proxies both under the same connector.
// ---------------------------------------------------------------------------

/** Google Business Profile reviews live under the v4 API surface. */
export const GBP_REVIEWS_API = "mybusiness.googleapis.com/v4";

/** Google caps reviews.list at 50 per page. */
export const GBP_REVIEW_PAGE_SIZE = 50;

/** Google caps a review reply at 4096 BYTES (not characters). */
export const GBP_REPLY_MAX_BYTES = 4096;

export const GBP_REVIEW_STAR_ENUM: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

/** The subset of the Google review resource DARB reads. */
export type GbpRawReview = {
  name?: string;
  reviewId?: string;
  reviewer?: {
    profilePhotoUrl?: string;
    displayName?: string;
    isAnonymous?: boolean;
  };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: {
    comment?: string;
    updateTime?: string;
    /** Newer responses carry the moderation state on the reply. */
    state?: string;
    policyViolation?: string;
  };
};

export type GbpReviewsListResponse = {
  reviews?: GbpRawReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
};

/** A review as DARB stores it in the cache (server -> RPC payload). */
export type NormalizedGbpReview = {
  google_review_id: string;
  google_review_resource_name: string;
  reviewer_display_name: string | null;
  reviewer_profile_photo_url: string | null;
  reviewer_is_anonymous: boolean;
  star_rating: number;
  comment: string | null;
  review_create_time: string | null;
  review_update_time: string | null;
  reply_comment: string | null;
  reply_update_time: string | null;
  reply_state: string | null;
  reply_policy_violation: string | null;
  google_review_url: string | null;
};

/** Maps Google's star enum to 1-5, or null when Google sent something unknown. */
export function starRatingToInt(
  value: string | undefined | null,
): number | null {
  if (!value) return null;
  return GBP_REVIEW_STAR_ENUM[value.toUpperCase()] ?? null;
}

/**
 * Google review -> cache row. Returns null when the review cannot be keyed
 * (no reviewId) or has no usable rating, so a malformed item is skipped rather
 * than corrupting the cache with a 0-star row.
 */
export function normalizeGbpReview(
  raw: GbpRawReview,
  opts: { accountId: string; locationId: string },
): NormalizedGbpReview | null {
  const reviewId = raw.reviewId?.trim();
  if (!reviewId) return null;
  const rating = starRatingToInt(raw.starRating);
  if (rating === null) return null;

  const reply = raw.reviewReply ?? {};
  const replyComment = reply.comment?.trim() ? reply.comment : null;
  const mapsUrl = `https://search.google.com/local/reviews?placeid=&q=${encodeURIComponent(reviewId)}`;

  return {
    google_review_id: reviewId,
    google_review_resource_name:
      raw.name?.trim() ||
      `accounts/${opts.accountId}/locations/${opts.locationId}/reviews/${reviewId}`,
    reviewer_display_name: raw.reviewer?.isAnonymous
      ? null
      : raw.reviewer?.displayName?.trim() || null,
    reviewer_profile_photo_url: raw.reviewer?.profilePhotoUrl?.trim() || null,
    reviewer_is_anonymous: Boolean(raw.reviewer?.isAnonymous),
    star_rating: rating,
    comment: raw.comment?.trim() || null,
    review_create_time: raw.createTime ?? null,
    review_update_time: raw.updateTime ?? null,
    reply_comment: replyComment,
    reply_update_time: reply.updateTime ?? null,
    reply_state: reply.state ?? null,
    reply_policy_violation: reply.policyViolation ?? null,
    // Google does not return a stable per-review URL; this is a best-effort
    // deep link the UI offers as "open in Google".
    google_review_url: mapsUrl,
  };
}

/**
 * Byte length of a reply, matching Google's 4096-byte limit. Arabic and emoji
 * cost 2-4 bytes each, so `String.length` undercounts and would let an
 * over-limit reply through the client.
 */
export function replyByteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  // Node fallback (server-side rendering / tests).
  return Buffer.byteLength(value, "utf8");
}

/** True when the reply is non-blank and within Google's byte limit. */
export function isValidReply(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && replyByteLength(value) <= GBP_REPLY_MAX_BYTES;
}

/** The gateway path for a location's reviews (relative to the connector base). */
export function reviewsPath(
  accountId: string,
  locationId: string,
  pageToken?: string,
): string {
  const q = new URLSearchParams({ pageSize: String(GBP_REVIEW_PAGE_SIZE) });
  if (pageToken) q.set("pageToken", pageToken);
  return `/${GBP_REVIEWS_API}/accounts/${accountId}/locations/${locationId}/reviews?${q}`;
}

/** The gateway path for a single review's reply. */
export function reviewReplyPath(
  accountId: string,
  locationId: string,
  reviewId: string,
): string {
  return `/${GBP_REVIEWS_API}/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`;
}
