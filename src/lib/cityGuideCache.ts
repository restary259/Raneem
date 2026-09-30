export const CITY_GUIDE_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

/** True when a cached place row was refreshed within the last 7 days. */
export function isCacheFresh(fetchedAt: string | null | undefined, now = Date.now()) {
  if (!fetchedAt) return false;
  const t = Date.parse(fetchedAt);
  return Number.isFinite(t) && now - t < CITY_GUIDE_CACHE_MS;
}
