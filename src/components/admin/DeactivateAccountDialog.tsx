import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Check, X } from 'lucide-react';

export interface DeactivateTarget {
  id: string;
  full_name: string;
  email: string;
  roleLabel: string;
}

interface Props {
  target: DeactivateTarget | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * Explicit, non-vague confirmation for the only destructive account action in
 * the admin area. Deactivating blocks sign-in and removes the role; it never
 * deletes the login identity or any case / financial history.
 */
const DeactivateAccountDialog: React.FC<Props> = ({ target, onOpenChange, onDone }) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const matches =
    !!target && confirmText.trim().toLowerCase() === target.email.trim().toLowerCase();

  const reset = () => {
    setConfirmText('');
    setReason('');
  };

  const run = async () => {
    if (!target || !matches || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_deactivate_account', {
        _target_id: target.id,
        _reason: reason.trim() || null,
      });
      if (error) throw error;
      const already = (data as { already_deactivated?: boolean } | null)?.already_deactivated;
      toast({
        description: already
          ? t('admin.team.alreadyDeactivated', 'This account was already deactivated.')
          : t('admin.team.deactivated', 'Account deactivated. History was kept.'),
      });
      reset();
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast({ variant: 'destructive', description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const removed = [
    t('admin.team.deactivateRemoved1', 'Sign-in access to Darb'),
    t('admin.team.deactivateRemoved2', 'Their dashboard and role'),
    t('admin.team.deactivateRemoved3', 'New assignments and notifications'),
  ];
  const kept = [
    t('admin.team.deactivateKept1', 'All cases and student records'),
    t('admin.team.deactivateKept2', 'Payments, commissions and payout history'),
    t('admin.team.deactivateKept3', 'Documents, messages and referral history'),
    t('admin.team.deactivateKept4', 'The login identity itself (can be reactivated)'),
  ];

  return (
    <AlertDialog
      open={!!target}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('admin.team.deactivateTitle', 'Deactivate this account?')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-start">
              <p className="text-foreground">
                {target?.full_name} — <span className="font-mono text-xs">{target?.email}</span>{' '}
                ({target?.roleLabel})
              </p>

              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="mb-1 font-medium text-destructive">
                  {t('admin.team.deactivateRemovedTitle', 'What is removed')}
                </p>
                <ul className="space-y-1 text-sm">
                  {removed.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-md border p-3">
                <p className="mb-1 font-medium">
                  {t('admin.team.deactivateKeptTitle', 'What is kept')}
                </p>
                <ul className="space-y-1 text-sm">
                  {kept.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-sm">
                {t(
                  'admin.team.deactivateIsolation',
                  'Only this account is affected. No other account, partner network or student is touched.',
                )}
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="deactivate-reason">
                  {t('admin.team.deactivateReason', 'Reason (optional, saved to the audit log)')}
                </Label>
                <Input
                  id="deactivate-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deactivate-confirm">
                  {t('admin.team.deactivateTypeEmail', 'Type the account email to confirm')}
                </Label>
                <Input
                  id="deactivate-confirm"
                  dir="ltr"
                  className="font-mono"
                  autoComplete="off"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={target?.email}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              void run();
            }}
            disabled={!matches || busy}
          >
            {busy ? '…' : t('admin.team.confirmDeactivate', 'Deactivate account')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeactivateAccountDialog;
