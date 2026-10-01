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
