import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { Crown } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  partnerId: string;
  partnerName: string;
  isMaster: boolean;
  /** Called after the flag was persisted, with the new value. */
  onChanged: (next: boolean) => void;
  /** Compact inline chip (directory rows) vs. plain switch (profile panel). */
  variant?: 'chip' | 'plain';
}

/**
 * Promotes / demotes a partner to Master Partner. Mirrors the Team → Manager
 * toggle, with an extra confirmation step because it changes the partner's own
 * dashboard. It is a pure role flag: earnings, referral code, referral history
 * and payout history are never touched, and demoting never cascades to the
 * partners they recruited.
 */
const MasterPartnerToggle: React.FC<Props> = ({
  partnerId, partnerName, isMaster, onChanged, variant = 'chip',
}) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const [pending, setPending] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = async () => {
    // Guard against a second confirmation arriving while the first write is
    // still in flight: rapid ON/OFF would otherwise race and the slower
    // response could leave the row showing a stale flag.
    if (pending === null || saving) return;
    const next = pending;
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from('profiles')
      .update({ is_master_partner: next })
      .eq('id', partnerId)
      .select('is_master_partner')
      .maybeSingle();
    setSaving(false);
    setPending(null);
    if (error) {
      toast({ variant: 'destructive', title: t('common.actionFailed', 'Action failed'), description: error.message });
      // No optimistic update was applied, so the row keeps the last known
      // persisted value and never gets stuck on a status that did not save.
      onChanged(isMaster);
      return;
    }
    // Report the value the database actually stored, not the requested one.
    const persisted = data ? !!data.is_master_partner : next;
    toast({
      title: persisted
        ? t('admin.payouts.masterUpgraded', 'Upgraded to Master Partner')
        : t('admin.payouts.masterDowngraded', 'Downgraded to Partner'),
    });
    onChanged(persisted);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      {variant === 'chip' ? (
        <label
          className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
          onClick={stop}
          title={t('admin.payouts.masterToggleHint', 'Role upgrade only — earnings, referral code and payout history stay exactly as they are.')}
        >
          <Crown className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{t('admin.payouts.masterBadge', 'Master')}</span>
          <Switch checked={isMaster} disabled={saving} onCheckedChange={(v) => setPending(v)} />
        </label>
      ) : (
        <Switch checked={isMaster} disabled={saving} onCheckedChange={(v) => setPending(v)} />
      )}

      <AlertDialog open={pending !== null} onOpenChange={(v) => { if (!v) setPending(null); }}>
        <AlertDialogContent onClick={stop}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending
                ? t('admin.payouts.masterConfirmTitle', 'Upgrade to Master Partner?')
                : t('admin.payouts.masterRevokeTitle', 'Remove Master Partner status?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? t('admin.payouts.masterConfirmBody', {
                    name: partnerName,
                    defaultValue: '{{name}} will get a recruitment invite link and a network dashboard (Network / Students / Performance). Their existing earnings, referral code, referral history and payout history will not be affected.',
                  })
                : t('admin.payouts.masterRevokeBody', {
                    name: partnerName,
                    defaultValue: '{{name}} goes back to a normal partner dashboard. Nothing is deleted — their network, earnings and payout history stay, and partners they recruited keep their records.',
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

export default MasterPartnerToggle;
