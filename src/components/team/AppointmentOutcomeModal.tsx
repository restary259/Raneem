import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

type Outcome = 'completed' | 'delayed' | 'cancelled' | 'rescheduled' | 'no_show';

interface Props {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  onSuccess: () => void;
}

export default function AppointmentOutcomeModal({ open, onClose, appointmentId, onSuccess }: Props) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const isRtl = i18n.language === 'ar';
  const [outcome, setOutcome] = useState<Outcome>('completed');
  const [notes, setNotes] = useState('');
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);

  const needsNewDate = outcome === 'rescheduled' || outcome === 'delayed';

  type OutcomeMeta = { value: Outcome; labelKey: string; descKey: string };

  const OUTCOMES: OutcomeMeta[] = [
    { value: 'completed', labelKey: 'team.outcome.completed', descKey: 'team.outcome.completedDesc' },
    { value: 'delayed', labelKey: 'team.outcome.delayed', descKey: 'team.outcome.delayedDesc' },
    { value: 'cancelled', labelKey: 'team.outcome.cancelled', descKey: 'team.outcome.cancelledDesc' },
    { value: 'rescheduled', labelKey: 'team.outcome.rescheduled', descKey: 'team.outcome.rescheduledDesc' },
    { value: 'no_show', labelKey: 'team.outcome.noShow', descKey: 'team.outcome.noShowDesc' },
  ];

  const handleSave = async () => {
    if (needsNewDate && !newDate) {
      toast({ variant: 'destructive', description: t('team.outcome.dateRequired') });
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke('record-appointment-outcome', {
        body: {
          appointment_id: appointmentId,
          outcome,
          outcome_notes: notes || null,
          new_scheduled_at: needsNewDate && newDate ? new Date(newDate).toISOString() : null,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (resp.error) throw new Error(resp.error.message);
      toast({ title: t('team.outcome.recorded') });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>{t('team.outcome.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <RadioGroup value={outcome} onValueChange={v => setOutcome(v as Outcome)}>
            {OUTCOMES.map(o => (
              <div key={o.value} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value={o.value} id={o.value} className="mt-0.5" />
                <Label htmlFor={o.value} className="cursor-pointer">
                  <span className="font-medium">{t(o.labelKey)}</span>
                  <p className="text-xs text-muted-foreground font-normal">{t(o.descKey)}</p>
                </Label>
              </div>
            ))}
          </RadioGroup>

          {needsNewDate && (
            <div className="space-y-1">
              <Label>{t('team.outcome.newDateTime')}</Label>
              <Input
                type="datetime-local"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label>{t('team.outcome.notes')}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('common.saving')}</>
              : t('team.outcome.saveOutcome')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
