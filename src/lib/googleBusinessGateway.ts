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
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "upstream"
  | "network"
  | "internal";

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
        : status === 404
          ? "not_found"
          : status === 429
            ? "rate_limited"
            : status >= 400 && status < 500
              ? "invalid_request"
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
 * PATCH for a Google location update. Google requires updateMask to name the
 * fields being written, so only the operator's intended fields change and the
 * rest of the location is left untouched. Retried on 429/5xx like PUT: the
 * update is absolute, so replaying it converges.
 */
export async function gbpPatch<T>(
  path: string,
  body: unknown,
  creds: { lovableKey: string; connectionKey: string },
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  return gbpRequest<T>("PATCH", path, creds, body, fetchImpl, sleep);
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

/**
 * POST for a Google *create*. Deliberately NOT retried at all: a 5xx OR a
 * dropped connection after Google already created the resource would make a
 * replay create a second one, so a network failure must surface as "uncertain"
 * for the caller to reconcile — never be retried. The caller de-duplicates with
 * an idempotency receipt instead.
 */
export async function gbpPost<T>(
  path: string,
  body: unknown,
  creds: { lovableKey: string; connectionKey: string },
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  return gbpRequest<T>(
    "POST",
    path,
    creds,
    body,
    fetchImpl,
    sleep,
    false,
    false,
  );
}

/**
 * POST raw bytes for a Google byte upload (media:startUpload -> upload bytes).
 * Also NOT retried at all: the upload session is single-use, so a replay would
 * target a spent session, and a dropped connection after Google accepted the
 * bytes is a "uncertain" outcome the caller must reconcile rather than retry.
 */
export async function gbpUploadBytes<T>(
  path: string,
  bytes: Uint8Array,
  contentType: string,
  creds: { lovableKey: string; connectionKey: string },
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  return gbpRequest<T>(
    "POST",
    path,
    creds,
    bytes,
    fetchImpl,
    sleep,
    false,
    false,
    contentType,
  );
}

async function gbpRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  creds: { lovableKey: string; connectionKey: string },
  body: unknown,
  fetchImpl: FetchLike,
  sleep: (ms: number) => Promise<void>,
  retryServerErrors = true,
  retryNetworkErrors = true,
  rawContentType?: string,
): Promise<T> {
  let last: GbpError | null = null;
  const isRaw = rawContentType !== undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(`${GBP_GATEWAY_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${creds.lovableKey}`,
          "X-Connection-Api-Key": creds.connectionKey,
          ...(body === undefined
            ? {}
            : { "Content-Type": isRaw ? rawContentType : "application/json" }),
        },
        // A Uint8Array is a valid fetch body at runtime (undici/Bun); the DOM
        // lib typing for BodyInit is narrower than the platform.
        ...(body === undefined
          ? {}
          : { body: (isRaw ? body : JSON.stringify(body)) as BodyInit }),
      });
    } catch (e) {
      last = new GbpError("network", 0, (e as Error).message);
      // A non-idempotent create must never replay a dropped connection: the
      // request may have reached Google and been applied.
      if (!retryNetworkErrors) throw last;
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

/**
 * Read mask for discovery: the fields DARB maps and shows, nothing more.
 *
 * `placeId`/`mapsUri` are NOT top-level Location fields — they live under
 * `metadata` (v1 `Metadata.placeId`), which `normalizeGbpLocation` already reads
 * (`loc.metadata?.placeId`). Requesting a bare `placeId` path makes Google reject
 * the whole `accounts.locations.list` call with INVALID_ARGUMENT, so the mask must
 * only name real top-level fields plus the nested `metadata` container.
 */
export const GBP_LOCATION_READ_MASK =
  "name,title,storeCode,phoneNumbers,websiteUri,categories,storefrontAddress,locationState,metadata";

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

type ConnectionLike = { id?: string | null; connection_status?: string | null };

/**
 * The DARB Google connection a discovery snapshot belongs to, chosen from the
 * admin-gated `admin_get_google_business_connections` rows. Prefers the most
 * recent `connected` row, else the first row; null when there is no connection.
 */
export function pickActiveConnectionId(
  rows: ConnectionLike[] | null | undefined,
): string | null {
  const list = Array.isArray(rows) ? rows : [];
  const connected = list.find((r) => r?.connection_status === "connected");
  return (connected ?? list[0])?.id ?? null;
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
export interface CollectedPages<T> {
  items: T[];
  /**
   * False when the page ceiling stopped the walk while the provider still had a
   * next token. Callers that reconcile a cached set against the provider MUST
   * treat an incomplete walk as "do not mark anything missing", or a capped
   * prefix would delete/flag real resources.
   */
  complete: boolean;
}

export async function collectAllPages<T>(
  fetchPage: (
    pageToken: string | undefined,
  ) => Promise<{ items: T[]; nextPageToken?: string }>,
  maxPages = 20,
): Promise<CollectedPages<T>> {
  const out: T[] = [];
  const seen = new Set<string>();
  let token: string | undefined;
  let complete = false;
  for (let page = 0; page < maxPages; page++) {
    const { items, nextPageToken } = await fetchPage(token);
    out.push(...items);
    if (!nextPageToken || seen.has(nextPageToken)) {
      complete = true;
      break;
    }
    seen.add(nextPageToken);
    token = nextPageToken;
  }
  return { items: out, complete };
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

// ---------------------------------------------------------------------------
// Phase 6 — pure profile helpers
//
// Google's Business Information API representation must not leak through the
// app: everything the UI sees goes through normalizeGbpProfile() first. The
// editable content is also hashed here so the client can detect "Google changed
// since you opened this" without a second round trip.
// ---------------------------------------------------------------------------

/** Google Business Information API (v1) surface for the location resource. */
export const GBP_PROFILE_API = "business_information/v1";

/** Read mask for the editable profile: exactly the fields DARB mirrors. */
export const GBP_PROFILE_READ_MASK = [
  "name",
  "title",
  "profile",
  "phoneNumbers",
  "websiteUri",
  "categories",
  "storefrontAddress",
  "regularHours",
  "specialHours",
  "latlng",
  "metadata",
  "locationState",
].join(",");

/** Google's description byte limit (not characters). */
export const GBP_DESCRIPTION_MAX_BYTES = 750;
/** Google allows up to 9 additional categories. */
export const GBP_MAX_ADDITIONAL_CATEGORIES = 9;

export type GbpWeekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export const GBP_WEEKDAYS: GbpWeekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

/** One opening period. `open`/`close` are 24h "HH:MM". */
export type GbpTimePeriod = { open: string; close: string };

/**
 * A week of opening hours keyed by weekday. `null` means CLOSED, which is
 * distinct from "not configured" (the key being absent) — the UI renders them
 * differently and Google treats them differently.
 */
export type GbpRegularHours = Partial<
  Record<GbpWeekday, GbpTimePeriod[] | null>
>;

export type GbpSpecialHour = {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  closed: boolean;
  periods?: GbpTimePeriod[];
};

/** The subset of the Google Location resource the profile editor reads. */
export type GbpRawProfile = {
  name?: string;
  title?: string;
  profile?: { description?: string };
  phoneNumbers?: { primaryPhone?: string; additionalPhones?: string[] };
  websiteUri?: string;
  categories?: {
    primaryCategory?: { displayName?: string; name?: string };
    additionalCategories?: { displayName?: string; name?: string }[];
  };
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  regularHours?: {
    periods?: {
      openDay?: string;
      openTime?: { hours?: number; minutes?: number };
      closeDay?: string;
      closeTime?: { hours?: number; minutes?: number };
    }[];
  };
  specialHours?: {
    specialHourPeriods?: {
      startDate?: { year?: number; month?: number; day?: number };
      endDate?: { year?: number; month?: number; day?: number };
      closed?: boolean;
      openTime?: { hours?: number; minutes?: number };
      closeTime?: { hours?: number; minutes?: number };
    }[];
  };
  latlng?: { latitude?: number; longitude?: number };
  metadata?: { placeId?: string; mapsUri?: string };
  locationState?: { isVerified?: boolean; isSuspended?: boolean };
};

/** A profile as DARB stores it (server -> RPC payload). */
export type NormalizedGbpProfile = {
  business_name: string | null;
  business_description: string | null;
  primary_category: string | null;
  additional_categories: string[];
  phone_primary: string | null;
  phone_additional: string[];
  website_url: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  postal_code: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  regular_hours: GbpRegularHours | null;
  special_hours: GbpSpecialHour[];
  google_state: string | null;
  verification_status: string | null;
};

/** Two-digit zero-padded clock component. */
function pad(n: number | undefined): string {
  return String(n ?? 0).padStart(2, "0");
}

/** Google TimeOfDay -> "HH:MM". */
export function googleTimeToClock(
  t: { hours?: number; minutes?: number } | undefined,
): string | null {
  if (!t) return null;
  return `${pad(t.hours)}:${pad(t.minutes)}`;
}

/** "HH:MM" -> Google TimeOfDay. */
export function clockToGoogleTime(
  clock: string,
): { hours: number; minutes: number } | null {
  const m = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(clock);
  if (!m) return null;
  return { hours: Number(m[1]), minutes: Number(m[2]) };
}

/** ISO date parts -> YYYY-MM-DD, or null when incomplete. */
function googleDateToIso(
  d: { year?: number; month?: number; day?: number } | undefined,
): string | null {
  if (!d?.year || !d?.month || !d?.day) return null;
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}

/**
 * Google regularHours -> DARB's weekday map. Google encodes a day's periods as
 * a flat list with openDay/closeDay; a day with no periods is left absent
 * (not configured) rather than collapsed into "closed".
 */
export function normalizeGbpRegularHours(
  raw: GbpRawProfile["regularHours"],
): GbpRegularHours | null {
  const periods = raw?.periods;
  if (!periods?.length) return null;
  const out: GbpRegularHours = {};
  for (const p of periods) {
    const day = (p.openDay ?? "").toUpperCase() as GbpWeekday;
    if (!GBP_WEEKDAYS.includes(day)) continue;
    const open = googleTimeToClock(p.openTime);
    const close = googleTimeToClock(p.closeTime);
    if (!open || !close) continue;
    const existing = out[day] ?? [];
    existing.push({ open, close });
    out[day] = existing;
  }
  return Object.keys(out).length ? out : null;
}

/** DARB weekday map -> Google regularHours periods. */
export function denormalizeGbpRegularHours(
  hours: GbpRegularHours | null,
): GbpRawProfile["regularHours"] {
  if (!hours) return { periods: [] };
  const periods: NonNullable<GbpRawProfile["regularHours"]>["periods"] = [];
  for (const day of GBP_WEEKDAYS) {
    const dayPeriods = hours[day];
    if (!dayPeriods) continue;
    for (const p of dayPeriods) {
      const openTime = clockToGoogleTime(p.open);
      const closeTime = clockToGoogleTime(p.close);
      if (!openTime || !closeTime) continue;
      periods.push({ openDay: day, openTime, closeDay: day, closeTime });
    }
  }
  return { periods };
}

export function normalizeGbpSpecialHours(
  raw: GbpRawProfile["specialHours"],
): GbpSpecialHour[] {
  const out: GbpSpecialHour[] = [];
  for (const p of raw?.specialHourPeriods ?? []) {
    const date = googleDateToIso(p.startDate);
    if (!date) continue;
    if (p.closed) {
      out.push({ date, closed: true });
      continue;
    }
    const open = googleTimeToClock(p.openTime);
    const close = googleTimeToClock(p.closeTime);
    if (!open || !close) continue;
    out.push({ date, closed: false, periods: [{ open, close }] });
  }
  return out;
}

/**
 * Google Location -> the editable DARB profile.
 *
 * Google is the source of truth: this is the canonical Google -> DARB mapping.
 */
export function normalizeGbpProfile(raw: GbpRawProfile): NormalizedGbpProfile {
  const addr = raw.storefrontAddress ?? {};
  const lines = addr.addressLines ?? [];
  const state = raw.locationState;
  return {
    business_name: raw.title?.trim() || null,
    business_description: raw.profile?.description?.trim() || null,
    primary_category:
      raw.categories?.primaryCategory?.displayName?.trim() || null,
    additional_categories: (raw.categories?.additionalCategories ?? [])
      .map((c) => c.displayName?.trim())
      .filter((c): c is string => Boolean(c)),
    phone_primary: raw.phoneNumbers?.primaryPhone?.trim() || null,
    phone_additional: (raw.phoneNumbers?.additionalPhones ?? [])
      .map((p) => p?.trim())
      .filter((p): p is string => Boolean(p)),
    website_url: raw.websiteUri?.trim() || null,
    address_line_1: lines[0]?.trim() || null,
    address_line_2: lines[1]?.trim() || null,
    postal_code: addr.postalCode?.trim() || null,
    city: addr.locality?.trim() || null,
    region: addr.administrativeArea?.trim() || null,
    country: addr.regionCode?.trim() || null,
    latitude:
      typeof raw.latlng?.latitude === "number" ? raw.latlng.latitude : null,
    longitude:
      typeof raw.latlng?.longitude === "number" ? raw.latlng.longitude : null,
    regular_hours: normalizeGbpRegularHours(raw.regularHours),
    special_hours: normalizeGbpSpecialHours(raw.specialHours),
    google_state: state?.isSuspended ? "SUSPENDED" : state ? "OPEN" : null,
    verification_status: state
      ? state.isVerified
        ? "verified"
        : "pending"
      : null,
  };
}

/**
 * DARB field name -> Google location field path. Used to build the updateMask so
 * a PATCH only touches the fields the operator actually changed.
 */
export const GBP_FIELD_TO_GOOGLE_PATH: Record<string, string> = {
  business_name: "title",
  business_description: "profile.description",
  primary_category: "categories.primaryCategory",
  additional_categories: "categories.additionalCategories",
  phone_primary: "phoneNumbers.primaryPhone",
  phone_additional: "phoneNumbers.additionalPhones",
  website_url: "websiteUri",
  address_line_1: "storefrontAddress.addressLines",
  address_line_2: "storefrontAddress.addressLines",
  postal_code: "storefrontAddress.postalCode",
  city: "storefrontAddress.locality",
  region: "storefrontAddress.administrativeArea",
  country: "storefrontAddress.regionCode",
  latitude: "latlng.latitude",
  longitude: "latlng.longitude",
  regular_hours: "regularHours",
  special_hours: "specialHours",
};

/**
 * Builds a Google Location PATCH body + updateMask from a set of DARB fields.
 *
 * Address lines are merged into a single array (Google stores them as a list),
 * and latitude/longitude collapse into one latlng object so the mask is not
 * duplicated. Returns the body, the comma-joined mask, and the Google paths
 * that were written (for the audit trail).
 */
export function buildGbpLocationPatch(fields: Record<string, unknown>): {
  body: GbpRawProfile;
  updateMask: string;
  googlePaths: string[];
} {
  const body: Record<string, unknown> = {};
  const paths = new Set<string>();

  const ensure = (obj: string): Record<string, unknown> => {
    if (!body[obj] || typeof body[obj] !== "object") body[obj] = {};
    return body[obj] as Record<string, unknown>;
  };

  if ("business_name" in fields) {
    body.title = fields.business_name;
    paths.add("title");
  }
  if ("business_description" in fields) {
    ensure("profile").description = fields.business_description;
    paths.add("profile.description");
  }
  if ("primary_category" in fields) {
    ensure("categories").primaryCategory = {
      displayName: fields.primary_category,
    };
    paths.add("categories.primaryCategory");
  }
  if ("additional_categories" in fields) {
    const list = Array.isArray(fields.additional_categories)
      ? (fields.additional_categories as string[])
      : [];
    ensure("categories").additionalCategories = list.map((displayName) => ({
      displayName,
    }));
    paths.add("categories.additionalCategories");
  }
  if ("phone_primary" in fields || "phone_additional" in fields) {
    const phones = ensure("phoneNumbers");
    if ("phone_primary" in fields) {
      phones.primaryPhone = fields.phone_primary;
      paths.add("phoneNumbers.primaryPhone");
    }
    if ("phone_additional" in fields) {
      phones.additionalPhones = Array.isArray(fields.phone_additional)
        ? fields.phone_additional
        : [];
      paths.add("phoneNumbers.additionalPhones");
    }
  }
  if ("website_url" in fields) {
    body.websiteUri = fields.website_url;
    paths.add("websiteUri");
  }

  const addrKeys = [
    "address_line_1",
    "address_line_2",
    "postal_code",
    "city",
    "region",
    "country",
  ] as const;
  if (addrKeys.some((k) => k in fields)) {
    const addr = ensure("storefrontAddress");
    if ("address_line_1" in fields || "address_line_2" in fields) {
      addr.addressLines = [fields.address_line_1, fields.address_line_2].filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      );
      paths.add("storefrontAddress.addressLines");
    }
    if ("postal_code" in fields) {
      addr.postalCode = fields.postal_code;
      paths.add("storefrontAddress.postalCode");
    }
    if ("city" in fields) {
      addr.locality = fields.city;
      paths.add("storefrontAddress.locality");
    }
    if ("region" in fields) {
      addr.administrativeArea = fields.region;
      paths.add("storefrontAddress.administrativeArea");
    }
    if ("country" in fields) {
      addr.regionCode = fields.country;
      paths.add("storefrontAddress.regionCode");
    }
  }

  if ("latitude" in fields || "longitude" in fields) {
    body.latlng = {
      latitude: fields.latitude,
      longitude: fields.longitude,
    };
    paths.add("latlng");
  }

  if ("regular_hours" in fields) {
    body.regularHours = denormalizeGbpRegularHours(
      (fields.regular_hours ?? null) as GbpRegularHours | null,
    );
    paths.add("regularHours");
  }
  if ("special_hours" in fields) {
    body.specialHours = { specialHourPeriods: [] };
    paths.add("specialHours");
  }

  return {
    body: body as GbpRawProfile,
    updateMask: Array.from(paths).join(","),
    googlePaths: Array.from(paths),
  };
}

/** The gateway path for a single location resource. */
export function locationPath(
  accountId: string,
  locationId: string,
  readMask = GBP_PROFILE_READ_MASK,
): string {
  const q = new URLSearchParams({ readMask });
  return `/${GBP_PROFILE_API}/accounts/${accountId}/locations/${locationId}?${q}`;
}

// ---------------------------------------------------------------------------
// Client-side validation (mirrors google_profile_field_error in the migration).
//
// These are UX affordances only: the server re-validates every field, so a
// forged client cannot store an invalid value.
// ---------------------------------------------------------------------------

const PHONE_RE = /^\+?[0-9 ()./-]{6,25}$/;
const URL_RE =
  /^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}(:[0-9]{1,5})?(\/.*)?$/;
const CLOCK_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function isValidPhone(value: string): boolean {
  const v = value.trim();
  if (!PHONE_RE.test(v)) return false;
  return (v.match(/[0-9]/g) ?? []).length >= 6;
}

export function isValidWebsite(value: string): boolean {
  return URL_RE.test(value.trim());
}

/** UTF-8 byte length, matching Google's byte-based limits. */
export function byteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return Buffer.byteLength(value, "utf8");
}

export function isWithinDescriptionLimit(value: string): boolean {
  return byteLength(value) <= GBP_DESCRIPTION_MAX_BYTES;
}

/** Validates a whole week; returns the offending weekday key, or null. */
export function invalidHoursDay(hours: GbpRegularHours | null): string | null {
  if (!hours) return null;
  for (const [day, periods] of Object.entries(hours)) {
    if (!GBP_WEEKDAYS.includes(day as GbpWeekday)) return day;
    if (!periods) continue;
    for (const p of periods) {
      if (!CLOCK_RE.test(p.open) || !CLOCK_RE.test(p.close)) return day;
      if (p.close <= p.open) return day;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phase 7 — pure media helpers
//
// Google's media surface is the v1 Business Information API (media.*). The
// gateway proxies it under the same connector as the profile/reviews calls.
// Everything the UI sees goes through normalizeGbpMedia() first.
// ---------------------------------------------------------------------------

/** Google caps media.list at 100 per page. */
export const GBP_MEDIA_PAGE_SIZE = 100;
/** Google caps a media description at 100 characters. */
export const GBP_MEDIA_DESCRIPTION_MAX = 100;
/** DARB's own upload size ceiling (10 MB), matching the staging bucket. */
export const GBP_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const GBP_MEDIA_MIN_DIMENSION = 250;

/** The supported image MIME types. Validated server-side, never by filename. */
export const GBP_MEDIA_ALLOWED_MIME: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

/**
 * DARB's friendly photo category. This is NOT a Google category: it is mapped
 * to `media_category` at publish time so the UI can offer "Team" without DARB
 * ever asserting that Google accepts the word "Team".
 */
export type DarbMediaCategory =
  "cover" | "logo" | "exterior" | "interior" | "team" | "other";

export const DARB_MEDIA_CATEGORIES: readonly DarbMediaCategory[] = [
  "cover",
  "logo",
  "exterior",
  "interior",
  "team",
  "other",
];

/**
 * DARB category -> Google's category enum. Google's own documented values are
 * COVER, LOGO, EXTERIOR, INTERIOR, FOOD_AND_DRINK, MENU, TEAM, OTHER; the ones
 * Google does not clearly accept collapse to ADDITIONAL, which is always safe.
 */
export const DARB_TO_GOOGLE_MEDIA_CATEGORY: Record<string, string> = {
  cover: "COVER",
  logo: "LOGO",
  exterior: "EXTERIOR",
  interior: "INTERIOR",
  team: "TEAM",
  other: "ADDITIONAL",
};

export function googleMediaCategoryFor(
  darbCategory: string | null | undefined,
): string {
  if (!darbCategory) return "ADDITIONAL";
  return DARB_TO_GOOGLE_MEDIA_CATEGORY[darbCategory] ?? "ADDITIONAL";
}

/** Google category -> the closest DARB label, for a sync with no DARB hint. */
export function darbMediaCategoryFor(
  googleCategory: string | null | undefined,
): DarbMediaCategory {
  const c = (googleCategory ?? "").toUpperCase();
  if (c === "COVER") return "cover";
  if (c === "LOGO") return "logo";
  if (c === "EXTERIOR") return "exterior";
  if (c === "INTERIOR") return "interior";
  if (c === "TEAM") return "team";
  return "other";
}

/** The subset of the Google media item DARB reads. */
export type GbpRawMedia = {
  name?: string;
  mediaFormat?: string;
  locationAssociation?: { category?: string };
  googleUrl?: string;
  googleUrlThumbnail?: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
  dimensions?: { widthPixels?: number; heightPixels?: number };
  attribution?: { profileName?: string; profileUrl?: string };
  description?: string;
  /** Present on some responses; the customer-media flag lives here. */
  mediaItemType?: string;
  insights?: unknown;
};

export type GbpMediaListResponse = {
  mediaItems?: GbpRawMedia[];
  nextPageToken?: string;
  totalMediaItemCount?: number;
};

/** A media row as DARB stores it (server -> RPC payload). */
export type NormalizedGbpMedia = {
  google_media_id: string;
  google_media_resource_name: string;
  media_format: string | null;
  media_category: string | null;
  darb_category: string | null;
  media_origin: "BUSINESS" | "CUSTOMER";
  google_source_url: string | null;
  google_thumbnail_url: string | null;
  google_full_url: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  attribution: string | null;
  media_state: string | null;
};

/**
 * True when Google identifies an item as customer-contributed. Google's
 * business-media endpoint historically returned only business media, but the
 * customer-media surface reuses the item shape; DARB keys off the explicit
 * marker when present and defaults to BUSINESS (never silently claims an item
 * the business owns).
 */
export function isCustomerMedia(raw: GbpRawMedia): boolean {
  const type = (raw.mediaItemType ?? "").toUpperCase();
  return type === "CUSTOMER" || type === "CUSTOMER_MEDIA";
}

/**
 * Google media item -> cache row. `locationId` keys the row; the media id is
 * the last path segment of `name`. Returns null when the item cannot be keyed.
 */
export function normalizeGbpMedia(
  raw: GbpRawMedia,
  opts: { locationId: string },
): NormalizedGbpMedia | null {
  const resourceName = raw.name?.trim();
  if (!resourceName) return null;
  const mediaId = resourceId(resourceName);
  if (!mediaId) return null;

  const googleCategory = raw.locationAssociation?.category?.trim() || null;
  const origin = isCustomerMedia(raw) ? "CUSTOMER" : "BUSINESS";
  const fullUrl = raw.googleUrl?.trim() || raw.sourceUrl?.trim() || null;
  const thumb =
    raw.googleUrlThumbnail?.trim() || raw.thumbnailUrl?.trim() || null;

  return {
    google_media_id: mediaId,
    google_media_resource_name: resourceName,
    media_format: raw.mediaFormat?.trim() || null,
    media_category: googleCategory,
    darb_category: googleCategory ? darbMediaCategoryFor(googleCategory) : null,
    media_origin: origin,
    google_source_url: raw.sourceUrl?.trim() || null,
    google_thumbnail_url: thumb,
    google_full_url: fullUrl,
    description: raw.description?.trim() || null,
    width: raw.dimensions?.widthPixels ?? null,
    height: raw.dimensions?.heightPixels ?? null,
    attribution: raw.attribution?.profileName?.trim() || null,
    media_state: "PUBLISHED",
  };
}

/** The gateway path for a location's media list. */
export function mediaPath(
  accountId: string,
  locationId: string,
  pageToken?: string,
): string {
  const q = new URLSearchParams({ pageSize: String(GBP_MEDIA_PAGE_SIZE) });
  if (pageToken) q.set("pageToken", pageToken);
  return `/${GBP_PROFILE_API}/accounts/${accountId}/locations/${locationId}/media?${q}`;
}

/** The gateway path for a single media item (GET / PATCH / DELETE). */
export function mediaItemPath(
  accountId: string,
  locationId: string,
  mediaId: string,
): string {
  return `/${GBP_PROFILE_API}/accounts/${accountId}/locations/${locationId}/media/${mediaId}`;
}

/** The gateway path that starts a byte upload (returns a resource name). */
export function mediaStartUploadPath(
  accountId: string,
  locationId: string,
): string {
  return `/${GBP_PROFILE_API}/accounts/${accountId}/locations/${locationId}/media:startUpload`;
}

/**
 * The Media.Create request body. Google requires `mediaFormat` plus, for a byte
 * upload, the `dataRef.resourceName` returned by startUpload. The DARB category
 * is deliberately NOT sent — only the mapped Google category is.
 */
export function buildGbpMediaCreateBody(opts: {
  mediaFormat?: string;
  googleCategory: string;
  description?: string | null;
  sourceUrl?: string | null;
  dataRefResourceName?: string | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    mediaFormat: opts.mediaFormat ?? "PHOTO",
    locationAssociation: { category: opts.googleCategory },
  };
  if (opts.description) body.description = opts.description;
  if (opts.sourceUrl) body.sourceUrl = opts.sourceUrl;
  if (opts.dataRefResourceName) {
    body.dataRef = { resourceName: opts.dataRefResourceName };
  }
  return body;
}

// ---------------------------------------------------------------------------
// Phase 7 — media client validation (mirrors the server; UX only)
// ---------------------------------------------------------------------------

export type MediaValidationCode =
  "empty" | "too_large" | "bad_type" | "bad_dimensions" | "too_small";

/** Validates size + MIME. Dimensions are validated after decoding. */
export function validateMediaFile(file: {
  size: number;
  type: string;
}): MediaValidationCode | null {
  if (!file.size) return "empty";
  if (file.size > GBP_MEDIA_MAX_BYTES) return "too_large";
  if (!GBP_MEDIA_ALLOWED_MIME.includes(file.type.toLowerCase()))
    return "bad_type";
  return null;
}

/**
 * Sniffs the real image type from its magic bytes. A file named `photo.jpg`
 * can contain anything, so the upload path validates the bytes rather than the
 * name or the browser-supplied MIME. Returns null when the bytes are not a
 * supported image.
 */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const b = bytes;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return "image/png";
  // GIF: "GIF87a" / "GIF89a"
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return "image/gif";
  // WEBP: "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  // AVIF/HEIF: ftyp box with an "avif"/"avis" brand at offset 8.
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase();
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}

/** Validates the real bytes of an upload. Rejects a spoofed MIME/extension. */
export function validateMediaBytes(
  bytes: Uint8Array,
  declaredType?: string,
): { mime: string | null; code: MediaValidationCode | null } {
  if (!bytes.length) return { mime: null, code: "empty" };
  if (bytes.length > GBP_MEDIA_MAX_BYTES)
    return { mime: null, code: "too_large" };
  const mime = sniffImageMime(bytes);
  if (!mime) return { mime: null, code: "bad_type" };
  if (declaredType && declaredType.toLowerCase() !== mime) {
    // A mismatch is a spoof attempt: trust the bytes, reject the upload.
    return { mime, code: "bad_type" };
  }
  return { mime, code: null };
}

/** Validates decoded dimensions. Rejects anything Google would reject. */
export function validateMediaDimensions(
  width: number,
  height: number,
): MediaValidationCode | null {
  if (!Number.isFinite(width) || !Number.isFinite(height))
    return "bad_dimensions";
  if (width <= 0 || height <= 0) return "bad_dimensions";
  if (width < GBP_MEDIA_MIN_DIMENSION || height < GBP_MEDIA_MIN_DIMENSION)
    return "too_small";
  return null;
}

// ---------------------------------------------------------------------------
// Phase 7 — pure Local Post helpers
//
// Google Local Posts live on the v4 API surface. Product posts are deliberately
// NOT modelled: Google does not currently allow creating them.
// ---------------------------------------------------------------------------

/** Google Local Posts live under the v4 API surface. */
export const GBP_POSTS_API = "mybusiness.googleapis.com/v4";

/** Google caps a post summary at 1500 characters. */
export const GBP_POST_SUMMARY_MAX = 1500;

/** The post types DARB offers. Product posts are deliberately NOT offered. */
export type GbpPostTopicType = "STANDARD" | "EVENT" | "OFFER";

/** The CTA types DARB offers, mapped to Google's enum. */
export type GbpPostCtaType =
  "LEARN_MORE" | "SIGN_UP" | "BOOK" | "CALL" | "ORDER" | "SHOP";

export const GBP_POST_CTA_TYPES: readonly GbpPostCtaType[] = [
  "LEARN_MORE",
  "SIGN_UP",
  "BOOK",
  "CALL",
  "ORDER",
  "SHOP",
];

/** CTAs that require an HTTPS URL (everything except CALL). */
export const GBP_CTA_REQUIRES_URL: readonly GbpPostCtaType[] = [
  "LEARN_MORE",
  "SIGN_UP",
  "BOOK",
  "ORDER",
  "SHOP",
];

/** Google's accepted language codes for a Local Post (BCP-47-ish subset). */
export const GBP_POST_LANGUAGES: readonly string[] = [
  "en",
  "de",
  "ar",
  "he",
  "tr",
  "ru",
  "fr",
  "es",
];

export type GbpRawPost = {
  name?: string;
  languageCode?: string;
  summary?: string;
  callToAction?: { actionType?: string; url?: string };
  event?: {
    title?: string;
    schedule?: {
      startDate?: unknown;
      startTime?: unknown;
      endDate?: unknown;
      endTime?: unknown;
    };
  };
  offer?: {
    couponCode?: string;
    redeemOnlineUrl?: string;
    termsConditions?: string;
  };
  media?: { mediaFormat?: string; sourceUrl?: string }[];
  topicType?: string;
  state?: string;
  searchUrl?: string;
  createTime?: string;
  updateTime?: string;
};

export type GbpPostsListResponse = {
  localPosts?: GbpRawPost[];
  nextPageToken?: string;
};

/** A post as DARB stores it (server -> RPC payload). */
export type NormalizedGbpPost = {
  google_post_id: string;
  google_post_resource_name: string;
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
  media_urls: string[];
  google_state: string | null;
  search_url: string | null;
  published_at: string | null;
  google_update_time: string | null;
};

function pad2(n: unknown): string {
  return String(typeof n === "number" ? n : 0).padStart(2, "0");
}

/** Google Date+TimeOfDay -> ISO-ish "YYYY-MM-DDTHH:MM" (no timezone applied). */
function googleDateTime(
  date: { year?: number; month?: number; day?: number } | undefined,
  time: { hours?: number; minutes?: number } | undefined,
): string | null {
  if (!date?.year || !date?.month || !date?.day) return null;
  const h = time?.hours ?? 0;
  const m = time?.minutes ?? 0;
  return `${date.year}-${pad2(date.month)}-${pad2(date.day)}T${pad2(h)}:${pad2(m)}`;
}

/**
 * Google Local Post -> cache row. Returns null when the post cannot be keyed.
 * The topic type is inferred from Google's own fields when it is absent, so a
 * synced Event/Offer is never mislabelled STANDARD.
 */
export function normalizeGbpPost(raw: GbpRawPost): NormalizedGbpPost | null {
  const resourceName = raw.name?.trim();
  if (!resourceName) return null;
  const postId = resourceId(resourceName);
  if (!postId) return null;

  const explicitTopic = raw.topicType?.toUpperCase();
  const topicType =
    explicitTopic === "EVENT" || explicitTopic === "OFFER"
      ? explicitTopic
      : raw.event
        ? "EVENT"
        : raw.offer
          ? "OFFER"
          : "STANDARD";

  const schedule = raw.event?.schedule;
  const cta = raw.callToAction ?? {};

  return {
    google_post_id: postId,
    google_post_resource_name: resourceName,
    topic_type: topicType,
    language_code: raw.languageCode?.trim() || "en",
    summary: raw.summary?.trim() || null,
    cta_type: cta.actionType?.trim().toUpperCase() || null,
    cta_url: cta.url?.trim() || null,
    event_title: raw.event?.title?.trim() || null,
    event_start: googleDateTime(
      schedule?.startDate as
        { year?: number; month?: number; day?: number } | undefined,
      schedule?.startTime as { hours?: number; minutes?: number } | undefined,
    ),
    event_end: googleDateTime(
      schedule?.endDate as
        { year?: number; month?: number; day?: number } | undefined,
      schedule?.endTime as { hours?: number; minutes?: number } | undefined,
    ),
    offer_coupon_code: raw.offer?.couponCode?.trim() || null,
    offer_url: raw.offer?.redeemOnlineUrl?.trim() || null,
    offer_terms: raw.offer?.termsConditions?.trim() || null,
    media_urls: (raw.media ?? [])
      .map((m) => m.sourceUrl?.trim())
      .filter((u): u is string => Boolean(u)),
    google_state: raw.state?.trim() || null,
    search_url: raw.searchUrl?.trim() || null,
    published_at: raw.createTime?.trim() || null,
    google_update_time: raw.updateTime?.trim() || null,
  };
}

/** The gateway path for a location's Local Posts list. */
export function postsPath(
  accountId: string,
  locationId: string,
  pageToken?: string,
): string {
  const q = new URLSearchParams({ pageSize: "100" });
  if (pageToken) q.set("pageToken", pageToken);
  return `/${GBP_POSTS_API}/accounts/${accountId}/locations/${locationId}/localPosts?${q}`;
}

/** The gateway path for a single Local Post (GET / PATCH / DELETE). */
export function postItemPath(
  accountId: string,
  locationId: string,
  postId: string,
): string {
  return `/${GBP_POSTS_API}/accounts/${accountId}/locations/${locationId}/localPosts/${postId}`;
}

/** The gateway path that creates a Local Post. */
export function postCreatePath(accountId: string, locationId: string): string {
  return `/${GBP_POSTS_API}/accounts/${accountId}/locations/${locationId}/localPosts`;
}

/** A DARB post draft (the fields the composer edits). */
export type GbpPostDraft = {
  topic_type: GbpPostTopicType;
  language_code: string;
  summary: string;
  cta_type: GbpPostCtaType | null;
  cta_url: string | null;
  event_title: string | null;
  event_start: string | null;
  event_end: string | null;
  offer_coupon_code: string | null;
  offer_url: string | null;
  offer_terms: string | null;
  media_ids: string[];
};

export type PostValidationCode =
  | "summary_required"
  | "summary_too_long"
  | "cta_url_required"
  | "cta_url_not_https"
  | "cta_url_not_allowed"
  | "event_title_required"
  | "event_time_required"
  | "event_time_order"
  | "offer_details_required"
  | "offer_url_not_https"
  | "language_invalid";

const HTTPS_RE = /^https:\/\/[^ \t\r\n]+$/i;

export function isHttpsUrl(value: string): boolean {
  return HTTPS_RE.test(value.trim());
}

/**
 * Validates a draft the same way the server's `google_post_field_error` does.
 * Returns the first problem, or null. This is a UX affordance — the server
 * re-validates every field.
 */
export function validateGbpPostDraft(
  draft: GbpPostDraft,
): PostValidationCode | null {
  const summary = draft.summary?.trim() ?? "";
  if (!summary) return "summary_required";
  if (summary.length > GBP_POST_SUMMARY_MAX) return "summary_too_long";
  if (!/^[a-z]{2}(-[A-Za-z]{2,})?$/.test(draft.language_code))
    return "language_invalid";

  if (draft.cta_type) {
    if (!GBP_POST_CTA_TYPES.includes(draft.cta_type)) return "cta_url_required";
    if (draft.cta_type === "CALL") {
      if (draft.cta_url && draft.cta_url.trim()) return "cta_url_not_allowed";
    } else {
      if (!draft.cta_url || !draft.cta_url.trim()) return "cta_url_required";
      if (!isHttpsUrl(draft.cta_url)) return "cta_url_not_https";
    }
  }

  if (draft.topic_type === "EVENT") {
    if (!draft.event_title?.trim()) return "event_title_required";
    if (!draft.event_start || !draft.event_end) return "event_time_required";
    if (new Date(draft.event_start) >= new Date(draft.event_end))
      return "event_time_order";
  }

  if (draft.topic_type === "OFFER") {
    const hasDetails =
      Boolean(draft.offer_coupon_code?.trim()) ||
      Boolean(draft.offer_url?.trim()) ||
      Boolean(draft.offer_terms?.trim());
    if (!hasDetails) return "offer_details_required";
    if (draft.offer_url?.trim() && !isHttpsUrl(draft.offer_url))
      return "offer_url_not_https";
  }

  return null;
}

/**
 * Builds Google's Local Post body from a validated draft.
 *
 * Local Post media is supplied as a URL (never bytes) — this is the deliberate
 * two-path split: location photos may be byte-uploaded, post media may not.
 */
export function buildGbpPostBody(
  draft: GbpPostDraft,
  mediaUrls: string[],
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    languageCode: draft.language_code,
    summary: draft.summary.trim(),
    topicType: draft.topic_type,
  };

  if (draft.cta_type) {
    body.callToAction = {
      actionType: draft.cta_type,
      ...(draft.cta_type === "CALL" ? {} : { url: draft.cta_url }),
    };
  }

  if (draft.topic_type === "EVENT" && draft.event_start && draft.event_end) {
    const start = new Date(draft.event_start);
    const end = new Date(draft.event_end);
    body.event = {
      title: draft.event_title ?? "",
      schedule: {
        startDate: {
          year: start.getFullYear(),
          month: start.getMonth() + 1,
          day: start.getDate(),
        },
        startTime: { hours: start.getHours(), minutes: start.getMinutes() },
        endDate: {
          year: end.getFullYear(),
          month: end.getMonth() + 1,
          day: end.getDate(),
        },
        endTime: { hours: end.getHours(), minutes: end.getMinutes() },
      },
    };
  }

  if (draft.topic_type === "OFFER") {
    body.offer = {
      ...(draft.offer_coupon_code?.trim()
        ? { couponCode: draft.offer_coupon_code.trim() }
        : {}),
      ...(draft.offer_url?.trim()
        ? { redeemOnlineUrl: draft.offer_url.trim() }
        : {}),
      ...(draft.offer_terms?.trim()
        ? { termsConditions: draft.offer_terms.trim() }
        : {}),
    };
  }

  const media = mediaUrls
    .filter((u) => Boolean(u))
    .map((sourceUrl) => ({ mediaFormat: "PHOTO", sourceUrl }));
  if (media.length) body.media = media;

  return body;
}
