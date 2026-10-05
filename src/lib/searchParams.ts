/**
 * Plain search-param (de)serialization for the router.
 *
 * TanStack's default uses JSON, so a numeric-looking string such as `page=2`
 * round-trips as `page=%222%22` and `searchParams.get("page")` returns `"2"`.
 * The compat `useSearchParams` shim mirrors react-router's URLSearchParams
 * semantics, so the router must read/write plain strings or numeric params
 * (pagination, single ids) silently break.
 */
export function parseSearchCompat(searchStr: string): Record<string, string> {
  if (searchStr[0] === "?") searchStr = searchStr.substring(1);
  const result: Record<string, string> = {};
  new URLSearchParams(searchStr).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function stringifySearchCompat(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const key in search) {
    const value = search[key];
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}
