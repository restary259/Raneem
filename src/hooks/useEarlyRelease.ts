import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export interface LockedReward {
  reward_id: string;
  amount: number;
  case_id: string | null;
  case_reference: string | null;
  student_name: string | null;
  reward_type: string | null;
  created_at: string;
  unlock_at: string;
}

/**
 * Admin-only view of a member's still-locked rewards plus the early-release
 * action. Both are server-gated RPCs (`has_role(auth.uid(),'admin')`), so the
 * UI never decides who may release money — it only surfaces the action.
 */
export function useEarlyRelease(memberId: string, enabled = true) {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const [rewards, setRewards] = useState<LockedReward[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [submitting, setSubmitting] = useState(false);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('get_member_locked_rewards', {
      p_member_id: memberId,
    });
    if (error) {
      console.warn('[earlyRelease] load failed', error.message);
      setRewards([]);
    } else {
      setRewards((data || []) as LockedReward[]);
    }
    setLoading(false);
  }, [enabled, memberId]);

  useEffect(() => { refetch(); }, [refetch]);

  const release = useCallback(
    async (rewardIds: string[], note: string): Promise<boolean> => {
      setSubmitting(true);
      const { data, error } = await (supabase as any).rpc('admin_early_release_rewards', {
        p_member_id: memberId,
        p_reward_ids: rewardIds,
        p_note: note,
      });
      setSubmitting(false);
      if (error) {
        toast({ variant: 'destructive', title: t('common.actionFailed'), description: error.message });
        return false;
      }
      toast({
        title: t('admin.payouts.earlyRelease.done', 'Payout released'),
        description: `${Number(data?.total_amount || 0).toLocaleString('en-US')} ₪`,
      });
      await refetch();
      return true;
    },
    [memberId, refetch, t, toast],
  );

  return { rewards, loading, submitting, refetch, release };
}
