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
  userId: string;
  /** The profiles boolean column this toggle owns (admin-only guarded column). */
  column: 'referral_code_enabled' | 'apply_form_enabled';
  value: boolean;
  /** Called after the flag was persisted, with the new value. */
  onChanged: (next: boolean) => void;
  enableTitle: string;
  enableBody: string;
  disableTitle: string;
  disableBody: string;
  enabledToast: string;
  disabledToast: string;
}

/**
 * Admin switch for one per-profile feature flag on `profiles`
 * (referral_code_enabled / apply_form_enabled). Mirrors AgentInviteToggle:
 * the switch opens a confirmation dialog, and the report value is what the
 * database actually stored — never the requested one. The flags are
 * admin-only settable via restrict_profiles_write.
 */
const ProfileFeatureToggle: React.FC<Props> = ({
  userId, column, value, onChanged,
  enableTitle, enableBody, disableTitle, disableBody, enabledToast, disabledToast,
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
      .update({ [column]: next })
      .eq('id', userId)
      .select(column)
      .maybeSingle();
    setSaving(false);
    setPending(null);
    if (error) {
      toast({ variant: 'destructive', title: t('common.actionFailed', 'Action failed'), description: error.message });
      onChanged(value);
      return;
    }
    const persisted = data ? !!data[column] : next;
    toast({ title: persisted ? enabledToast : disabledToast });
    onChanged(persisted);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <Switch checked={value} disabled={saving} onCheckedChange={(v) => setPending(v)} />

      <AlertDialog open={pending !== null} onOpenChange={(v) => { if (!v) setPending(null); }}>
        <AlertDialogContent onClick={stop}>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending ? enableTitle : disableTitle}</AlertDialogTitle>
            <AlertDialogDescription>{pending ? enableBody : disableBody}</AlertDialogDescription>
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

export default ProfileFeatureToggle;
