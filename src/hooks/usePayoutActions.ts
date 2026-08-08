import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

/**
 * Every admin write to a payout request goes through
 * admin_respond_payout_request() — never a direct client write to
 * payout_requests. The RPC audits, syncs the linked rewards and posts the
 * status message back into the requester's chat thread.
 */
export function usePayoutActions() {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  const respond = useCallback(
    async (
      requestId: string,
      action: 'approve' | 'reject' | 'pay',
      note?: string,
      transactionRef?: string,
    ): Promise<boolean> => {
      const { error } = await (supabase as any).rpc('admin_respond_payout_request', {
        p_request_id: requestId,
        p_action: action,
        p_note: note || null,
        p_transaction_ref: transactionRef || null,
      });
      if (error) {
        toast({ variant: 'destructive', title: t('common.actionFailed'), description: error.message });
        return false;
      }
      toast({ title: t('admin.payouts.statusUpdated') });
      return true;
    },
    [toast, t],
  );

  return { respond };
}
