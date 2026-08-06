import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AuthFailureSpike {
  target: string;
  source: string;
  failure_count: number;
  last_seen: string;
  is_new: boolean;
}

/**
 * Loads authorization-failure spikes (repeated 401/403 or RLS denials on the
 * same target) for the admin alert banner. Admin-only by policy.
 */
export function useAuthFailureSpikes(pollMs = 120000) {
  const [spikes, setSpikes] = useState<AuthFailureSpike[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await (supabase.rpc as any)('get_auth_failure_spikes', {
      p_window: '01:00:00',
      p_threshold: 10,
    });
    if (!error) setSpikes((data ?? []) as AuthFailureSpike[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    if (!pollMs) return;
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { spikes, loading, refetch: load };
}
