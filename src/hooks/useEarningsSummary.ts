import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EarningsItem {
  reward_id: string;
  commission_reference: string | null;
  case_id: string | null;
  case_reference: string | null;
  student_name: string | null;
  reward_type: string | null;
  recipient_role: string | null;
  rate_used: number | null;
  base_amount: number | null;
  rate_source: string | null;
  amount: number;
  /** Mutually exclusive bucket: locked | available | requested | paid */
  status: 'locked' | 'available' | 'requested' | 'paid' | 'other';
  created_at: string;
  unlock_at: string;
}

export interface EarningsSummary {
  total: number;
  locked: number;
  available: number;
  requested: number;
  paid: number;
  next_unlock_at: string | null;
  has_open_request: boolean;
  items: EarningsItem[];
}

const EMPTY: EarningsSummary = {
  total: 0,
  locked: 0,
  available: 0,
  requested: 0,
  paid: 0,
  next_unlock_at: null,
  has_open_request: false,
  items: [],
};

/**
 * Single authoritative source for a partner's or team member's commission
 * balances. All totals (locked / available / requested / paid) come from the
 * backend `get_my_earnings_summary` RPC — never recomputed on the client.
 */
export function useEarningsSummary(enabled = true) {
  const [summary, setSummary] = useState<EarningsSummary>(EMPTY);
  const [loading, setLoading] = useState(enabled);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('get_my_earnings_summary');
    if (!error && data) {
      setSummary({ ...EMPTY, ...(data as EarningsSummary) });
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => { refetch(); }, [refetch]);

  return { summary, loading, refetch };
}
