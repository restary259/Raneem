import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  caseId: string;
  actorId: string;
  actorName: string;
  studentEmail?: string;
  studentFullName?: string;
  studentPhone?: string;
  onSuccess: () => void;
}

export default function PaymentConfirmationForm({ caseId, actorId, actorName, studentEmail, studentFullName, studentPhone, onSuccess }: Props) {
  const { toast } = useToast();
  const [serviceFee, setServiceFee] = useState('');
  const [translationFee, setTranslationFee] = useState('0');
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [saving, setSaving] = useState(false);

  const total = (parseFloat(serviceFee) || 0) + (parseFloat(translationFee) || 0);

  const handleConfirm = async () => {
    if (!paymentReceived) {
      toast({ variant: 'destructive', description: 'You must confirm payment was received' });
      return;
    }
    if (!serviceFee || parseFloat(serviceFee) <= 0) {
      toast({ variant: 'destructive', description: 'Service fee must be greater than 0' });
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();

      // Update case_submissions
      await supabase.from('case_submissions').upsert({
        case_id: caseId,
        service_fee: parseFloat(serviceFee),
        translation_fee: parseFloat(translationFee) || 0,
        payment_confirmed: true,
        payment_confirmed_at: now,
        payment_confirmed_by: actorId,
        submitted_at: now,
        submitted_by: actorId,
      }, { onConflict: 'case_id' });

      // Update case status to submitted
      await supabase.from('cases').update({ status: 'submitted' }).eq('id', caseId);

      // Create student account if email provided
      if (studentEmail && studentFullName) {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.functions.invoke('create-student-from-case', {
          body: { case_id: caseId, student_email: studentEmail, student_full_name: studentFullName, student_phone: studentPhone ?? null },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
      }

      await supabase.rpc('log_activity' as any, {
        p_actor_id: actorId,
        p_actor_name: actorName,
        p_action: 'payment_confirmed',
        p_entity_type: 'case',
        p_entity_id: caseId,
        p_metadata: { service_fee: serviceFee, translation_fee: translationFee },
      });

      toast({ title: 'Payment confirmed — case submitted' });
      onSuccess();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Service Fee (ILS) *</Label>
          <Input type="number" min="0" step="100" value={serviceFee} onChange={e => setServiceFee(e.target.value)} placeholder="e.g. 5000" />
        </div>
        <div className="space-y-1">
          <Label>Translation Fee (ILS)</Label>
          <Input type="number" min="0" step="50" value={translationFee} onChange={e => setTranslationFee(e.target.value)} placeholder="0" />
        </div>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
          <span className="text-sm font-medium">Total</span>
          <span className="text-lg font-bold text-primary">{total.toLocaleString()} ILS</span>
        </div>
      )}

      <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
        <Checkbox id="payment_received" checked={paymentReceived} onCheckedChange={v => setPaymentReceived(v === true)} />
        <Label htmlFor="payment_received" className="cursor-pointer text-sm leading-tight">
          I confirm that payment of <strong>{total.toLocaleString()} ILS</strong> has been received in full.
        </Label>
      </div>

      <Button onClick={handleConfirm} disabled={saving || !paymentReceived} className="w-full">
        {saving ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />Confirming...</> : 'Confirm Payment & Submit Case'}
      </Button>
    </div>
  );
}
