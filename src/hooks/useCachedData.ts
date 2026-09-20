import { useCallback } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useRealtimeSubscription } from "./useRealtimeSubscription";

/**
 * Cache-backed replacement for the `useState` + `useEffect` + `fetchData`
 * pattern used across the dashboards.
 *
 * Why this exists: local component state dies with the component. Every route
 * change and every tab switch unmounted the page, wiped its data and refetched
 * from scratch, so returning to a page visited seconds earlier cost a full
 * round trip. Routing the same fetchers through the shared query cache
 * (configured in `src/router.tsx`: 60s stale, 10min gc, keep-previous-data)
 * makes a revisit render instantly from cache and refresh in the background.
 *
 * The returned shape intentionally mirrors the old manual pattern
 * (`{ data, loading, error, refetch }`) so page conversions stay surgical.
 *
 * Security is unchanged: the same Supabase calls run under the same RLS.
 * Nothing is cached that the caller could not already read.
 */
export function useCachedData<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options?: {
    /** Skip the fetch until prerequisites (e.g. the user id) are known. */
    enabled?: boolean;
    /**
     * How long the cached value is served without a background refresh.
     * Defaults to the global 60s. Use a short value for money/permission
     * surfaces and a long one for catalog-style data.
     */
    staleTime?: number;
  },
) {
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    ...(options?.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    data: query.data,
    /**
     * True only while there is nothing to show yet. A background refresh of
     * already-cached data must not blank the page — that was the old
     * "everything flashes a skeleton again" behaviour.
     */
    loading: enabled && query.data === undefined && query.isFetching,
    /** True whenever a request is in flight, for subtle refresh indicators. */
    isFetching: query.isFetching,
    error: query.error,
    refetch,
  };
}

/**
 * Invalidate a cached query when a table changes, instead of re-running a
 * whole page-level `load()`. Marks the entry stale so the next render (or the
 * currently mounted observer) refreshes it in the background while the
 * existing data stays on screen.
 */
export function useRealtimeInvalidate(
  table: string,
  queryKey: QueryKey,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
    // queryKey is recreated per render by callers; serialize for stability.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, JSON.stringify(queryKey)]);
  useRealtimeSubscription(table, invalidate, enabled);
}
