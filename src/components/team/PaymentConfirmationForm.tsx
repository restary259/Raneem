import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface Props {
  caseId: string;
  actorId: string;
  actorName: string;
  onSuccess: () => void;
}

/** Stage 1: Confirms payment received → moves case to payment_confirmed */
export default function PaymentConfirmationForm({ caseId, actorId, actorName, onSuccess }: Props) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const isRtl = i18n.language === 'ar';
  const [serviceFee, setServiceFee] = useState('');
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [saving, setSaving] = useState(false);

  const total = parseFloat(serviceFee) || 0;

  const handleConfirm = async () => {
    if (!paymentReceived) {
      toast({ variant: 'destructive', description: t('team.payment.mustConfirm') });
      return;
    }
    if (!serviceFee || parseFloat(serviceFee) <= 0) {
      toast({ variant: 'destructive', description: t('team.payment.feeRequired') });
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();

      const { error: subErr } = await supabase.from('case_submissions').upsert({
        case_id: caseId,
        service_fee: parseFloat(serviceFee),
        translation_fee: parseFloat(translationFee) || 0,
        payment_confirmed: true,
        payment_confirmed_at: now,
        payment_confirmed_by: actorId,
      }, { onConflict: 'case_id' });
      if (subErr) throw subErr;

      const { error: caseErr } = await supabase.from('cases').update({ status: 'payment_confirmed' }).eq('id', caseId);
      if (caseErr) throw caseErr;

      await supabase.rpc('log_activity' as any, {
        p_actor_id: actorId,
        p_actor_name: actorName,
        p_action: 'payment_confirmed',
        p_entity_type: 'case',
        p_entity_id: caseId,
        p_metadata: { service_fee: serviceFee, translation_fee: translationFee },
      });

      toast({ title: t('team.payment.confirmed') });
      onSuccess();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('team.payment.confirmDesc')}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>{t('team.payment.serviceFeeLabel')}</Label>
          <Input type="number" min="0" step="100" value={serviceFee} onChange={e => setServiceFee(e.target.value)} placeholder="e.g. 5000" />
        </div>
        <div className="space-y-1">
          <Label>{t('team.payment.translationFeeLabel')}</Label>
          <Input type="number" min="0" step="50" value={translationFee} onChange={e => setTranslationFee(e.target.value)} placeholder="0" />
        </div>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
          <span className="text-sm font-medium">{t('team.payment.total')}</span>
          <span className="text-lg font-bold text-primary">{total.toLocaleString('en-US')} ILS</span>
        </div>
      )}

      <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
        <Checkbox id="payment_received" checked={paymentReceived} onCheckedChange={v => setPaymentReceived(v === true)} />
        <Label htmlFor="payment_received" className="cursor-pointer text-sm leading-tight">
          {t('team.payment.confirmCheckbox', { amount: total.toLocaleString('en-US') })}
        </Label>
      </div>

      <Button onClick={handleConfirm} disabled={saving || !paymentReceived} className="w-full">
        {saving
          ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('team.payment.confirming')}</>
          : t('team.payment.confirmBtn')}
      </Button>
    </div>
  );
}
