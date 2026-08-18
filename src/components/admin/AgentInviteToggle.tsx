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
  /** Whether the agent may send partner/ambassador invites directly. */
  canInvite: boolean;
  /** Called after the flag was persisted, with the new value. */
  onChanged: (next: boolean) => void;
}

/**
 * Grants / revokes an Agent's direct-invite permission. When enabled, the
 * agent can invite partners & ambassadors from their own dashboard. The flag
 * is admin-only settable via restrict_profiles_write, and the confirmation
 * step only flips the permission — it never touches earnings, referral codes
 * or payout history.
 */
const AgentInviteToggle: React.FC<Props> = ({
  agentId, agentName, canInvite, onChanged,
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
      .update({ agent_can_invite_directly: next })
      .eq('id', agentId)
      .select('agent_can_invite_directly')
      .maybeSingle();
    setSaving(false);
    setPending(null);
    if (error) {
      toast({ variant: 'destructive', title: t('common.actionFailed', 'Action failed'), description: error.message });
      onChanged(canInvite);
      return;
    }
    // Report the value the database actually stored, not the requested one.
    const persisted = data ? !!data.agent_can_invite_directly : next;
    toast({
      title: persisted
        ? t('admin.agents.inviteGranted', 'Direct invite enabled')
        : t('admin.agents.inviteRevoked', 'Direct invite disabled'),
    });
    onChanged(persisted);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <Switch checked={canInvite} disabled={saving} onCheckedChange={(v) => setPending(v)} />

      <AlertDialog open={pending !== null} onOpenChange={(v) => { if (!v) setPending(null); }}>
        <AlertDialogContent onClick={stop}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending
                ? t('admin.agents.grantTitle', 'Allow direct invites?')
                : t('admin.agents.revokeTitle', 'Disable direct invites?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? t('admin.agents.grantBody', {
                    name: agentName,
                    defaultValue: '{{name}} will be able to send partner & ambassador invitations and create those accounts directly from their own dashboard. Their earnings, referral code and payout history are not affected.',
                  })
                : t('admin.agents.revokeBody', {
                    name: agentName,
                    defaultValue: '{{name}} will no longer be able to invite partners or ambassadors directly. Nothing is deleted — existing recruits, earnings and payout history stay.',
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

export default AgentInviteToggle;