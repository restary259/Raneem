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
  const { i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';
  const [serviceFee, setServiceFee] = useState('');
  const [translationFee, setTranslationFee] = useState('0');
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [saving, setSaving] = useState(false);

  const total = (parseFloat(serviceFee) || 0) + (parseFloat(translationFee) || 0);

  const handleConfirm = async () => {
    if (!paymentReceived) {
      toast({ variant: 'destructive', description: isAr ? 'يجب تأكيد استلام الدفع' : 'You must confirm payment was received' });
      return;
    }
    if (!serviceFee || parseFloat(serviceFee) <= 0) {
      toast({ variant: 'destructive', description: isAr ? 'رسوم الخدمة يجب أن تكون أكبر من صفر' : 'Service fee must be greater than 0' });
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();

      // Upsert case_submissions with payment info
      const { error: subErr } = await supabase.from('case_submissions').upsert({
        case_id: caseId,
        service_fee: parseFloat(serviceFee),
        translation_fee: parseFloat(translationFee) || 0,
        payment_confirmed: true,
        payment_confirmed_at: now,
        payment_confirmed_by: actorId,
      }, { onConflict: 'case_id' });
      if (subErr) throw subErr;

      // Move case to payment_confirmed (NOT submitted yet — that's a separate step)
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

      toast({ title: isAr ? 'تم تأكيد الدفع' : 'Payment confirmed' });
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
        {isAr ? 'أدخل مبالغ الخدمة وأكد استلام الدفع من الطالب.' : 'Enter service amounts and confirm payment has been received from the student.'}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>{isAr ? 'رسوم الخدمة (شيكل) *' : 'Service Fee (ILS) *'}</Label>
          <Input type="number" min="0" step="100" value={serviceFee} onChange={e => setServiceFee(e.target.value)} placeholder="e.g. 5000" />
        </div>
        <div className="space-y-1">
          <Label>{isAr ? 'رسوم الترجمة (شيكل)' : 'Translation Fee (ILS)'}</Label>
          <Input type="number" min="0" step="50" value={translationFee} onChange={e => setTranslationFee(e.target.value)} placeholder="0" />
        </div>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
          <span className="text-sm font-medium">{isAr ? 'الإجمالي' : 'Total'}</span>
          <span className="text-lg font-bold text-primary">{total.toLocaleString()} ILS</span>
        </div>
      )}

      <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
        <Checkbox id="payment_received" checked={paymentReceived} onCheckedChange={v => setPaymentReceived(v === true)} />
        <Label htmlFor="payment_received" className="cursor-pointer text-sm leading-tight">
          {isAr
            ? `أؤكد استلام مبلغ ${total.toLocaleString()} شيكل بالكامل`
            : `I confirm that payment of ${total.toLocaleString()} ILS has been received in full.`}
        </Label>
      </div>

      <Button onClick={handleConfirm} disabled={saving || !paymentReceived} className="w-full">
        {saving
          ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{isAr ? 'جار الحفظ...' : 'Saving...'}</>
          : (isAr ? 'تأكيد الدفع' : 'Confirm Payment Received')}
      </Button>
    </div>
  );
}
