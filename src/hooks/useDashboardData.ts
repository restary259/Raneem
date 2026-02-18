import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getInfluencerDashboard,
  getTeamDashboard,
  getAdminDashboard,
  InfluencerDashboardData,
  TeamDashboardData,
  AdminDashboardData,
} from '@/integrations/supabase/dataService';

type DashboardType = 'influencer' | 'team' | 'admin';

type DataForType<T extends DashboardType> =
  T extends 'influencer' ? InfluencerDashboardData :
  T extends 'team' ? TeamDashboardData :
  AdminDashboardData;

interface UseDashboardDataOptions<T extends DashboardType> {
  type: T;
  userId?: string;
  enabled?: boolean;
  onError?: (error: string) => void;
}

interface UseDashboardDataResult<T extends DashboardType> {
  data: DataForType<T> | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useDashboardData<T extends DashboardType>({
  type,
  userId,
  enabled = true,
  onError,
}: UseDashboardDataOptions<T>): UseDashboardDataResult<T> {
  const [data, setData] = useState<DataForType<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Store onError in a ref so changing the callback never recreates refetch
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; });

  // Guard against concurrent in-flight fetches (prevents AbortError loops)
  const isFetchingRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    if ((type === 'influencer' || type === 'team') && !userId) return;

    // Skip if already fetching — prevents the AbortError cascade
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    setIsLoading(true);
    setError(null);

    try {
      let result: { data: any; error: string | null };

      if (type === 'influencer' && userId) {
        result = await getInfluencerDashboard(userId);
      } else if (type === 'team' && userId) {
        result = await getTeamDashboard(userId);
      } else {
        result = await getAdminDashboard();
      }

      if (result.error) {
        setError(result.error);
        onErrorRef.current?.(result.error);
      } else {
        setData(result.data as DataForType<T>);
      }
    } catch (err: any) {
      // AbortError means the component unmounted or a newer fetch took over — not a real error
      if (err?.name === 'AbortError') {
        isFetchingRef.current = false;
        setIsLoading(false);
        return;
      }
      const msg = err?.message ?? 'Unexpected error loading dashboard';
      setError(msg);
      onErrorRef.current?.(msg);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [type, userId, enabled]); // onError intentionally omitted — stored in ref

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, error, isLoading, refetch };
}
