/**
 * Pure helpers for Google Business Profile gateway calls (no secrets here).
 * Server code passes in fetch + credentials; this keeps retry/error mapping testable.
 */

export const GBP_GATEWAY_URL = "https://connector-gateway.lovable.dev/google_business_profile";

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
    status === 401 ? "unauthorized" : status === 403 ? "forbidden" : status === 429 ? "rate_limited" : "upstream";
  return new GbpError(code, status, message || `HTTP ${status}`);
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** GET with at most 3 attempts; retries only 429 and 5xx (reads are safe to retry). */
export async function gbpGet<T>(
  path: string,
  creds: { lovableKey: string; connectionKey: string },
  fetchImpl: FetchLike = fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  let last: GbpError | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(`${GBP_GATEWAY_URL}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${creds.lovableKey}`,
          "X-Connection-Api-Key": creds.connectionKey,
        },
      });
    } catch (e) {
      last = new GbpError("network", 0, (e as Error).message);
      await sleep(250 * 2 ** attempt);
      continue;
    }
    if (res.ok) return (await res.json()) as T;
    const body = await res.text();
    last = mapGbpError(res.status, body);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === 2) throw last;
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt + Math.random() * 100;
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
