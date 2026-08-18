import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  agentId: string;
  agentName: string;
  /** Whether the agent may create partner/ambassador accounts manually. */
  canCreateAccounts: boolean;
  /** Called after the flag was persisted, with the new value. */
  onChanged: (next: boolean) => void;
}

/**
 * Grants / revokes an Agent's manual-account-creation permission. When
 * enabled, the agent can create partner & ambassador accounts directly from
 * their own dashboard and receive a temp password to share. The flag is
 * admin-only settable via restrict_profiles_write (exactly like
 * agent_can_invite_directly). Mirrors AgentInviteToggle: it only flips the
 * permission — it never touches earnings, referral codes or payout history.
 */
const AgentCreateAccountsToggle: React.FC<Props> = ({
  agentId, agentName, canCreateAccounts, onChanged,
}) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const [pending, setPending] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = async () => {
    if (pending === null || saving) return;
    const next = pending;
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from('profiles')
      .update({ agent_can_create_accounts: next })
      .eq('id', agentId)
      .select('agent_can_create_accounts')
      .maybeSingle();
    setSaving(false);
    setPending(null);
    if (error) {
      toast({ variant: 'destructive', title: t('common.actionFailed', 'Action failed'), description: error.message });
      onChanged(canCreateAccounts);
      return;
    }
    const persisted = data ? !!data.agent_can_create_accounts : next;
    toast({
      title: persisted
        ? t('admin.agents.createAccountsGranted', 'Manual account creation enabled')
        : t('admin.agents.createAccountsRevoked', 'Manual account creation disabled'),
    });
    onChanged(persisted);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <Switch checked={canCreateAccounts} disabled={saving} onCheckedChange={(v) => setPending(v)} />

      <AlertDialog open={pending !== null} onOpenChange={(v) => { if (!v) setPending(null); }}>
        <AlertDialogContent onClick={stop}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending
                ? t('admin.agents.createGrantTitle', 'Allow manual account creation?')
                : t('admin.agents.createRevokeTitle', 'Disable manual account creation?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? t('admin.agents.createGrantBody', {
                    name: agentName,
                    defaultValue: '{{name}} will be able to create partner & ambassador accounts directly from their own dashboard and receive a temporary password to share with the recruit. Their earnings, referral code and payout history are not affected.',
                  })
                : t('admin.agents.createRevokeBody', {
                    name: agentName,
                    defaultValue: '{{name}} will no longer be able to create accounts manually (direct invites remain available if enabled). Nothing is deleted — existing recruits, earnings and payout history stay.',
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={apply} disabled={saving}>
              {t('common.confirm', 'Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AgentCreateAccountsToggle;
