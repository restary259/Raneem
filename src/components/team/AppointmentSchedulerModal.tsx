import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppointmentPicker from './AppointmentPicker';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: string;
  teamMemberId: string;
  actorName: string;
  guestName?: string;
  /** Current pipeline stage — the case only advances when it is still `contacted`. */
  caseStatus?: string;
  onSuccess: () => void;
}

const DURATIONS = [15, 30, 45, 60, 90];

/** Turns a database STAGE_BLOCKED error into a readable sentence. */
function readableError(err: unknown): string {
  const raw =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);
  return raw.replace(/^STAGE_BLOCKED:\s*/i, '');
}

export default function AppointmentSchedulerModal({ open, onClose, caseId, teamMemberId, actorName, guestName, caseStatus, onSuccess }: Props) {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const [slot, setSlot] = useState<Date | null>(null);
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!slot) {
      toast({ variant: 'destructive', description: t('lawyer.picker.selectSlot', 'Please pick a date and time') });
      return;
    }
    if (conflict) {
      toast({ variant: 'destructive', description: t('lawyer.picker.conflict', 'This time overlaps another appointment') });
      return;
    }
    setSaving(true);
    try {
      // .select() is required: a row blocked by row-level security returns no
      // error and no rows, so without it a silent failure looks like success.
      const { data: inserted, error } = await supabase
        .from('appointments')
        .insert({
          case_id: caseId,
          team_member_id: teamMemberId,
          guest_name: guestName || null,
          scheduled_at: slot.toISOString(),
          duration_minutes: duration,
          notes: notes || null,
        })
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!inserted) throw new Error(t('lawyer.picker.notAllowed', 'You are not allowed to schedule on this case'));

      // Only the first appointment moves the case forward.
      if (caseStatus === 'contacted') {
        const { data: moved, error: caseErr } = await supabase
          .from('cases')
          .update({ status: 'appointment_scheduled' })
          .eq('id', caseId)
          .select('id')
          .maybeSingle();
        if (caseErr) throw caseErr;
        if (!moved) throw new Error(t('lawyer.picker.stageFailed', 'The appointment was saved but the case stage did not change'));
      }

      await supabase.rpc('log_activity' as any, {
        p_actor_id: teamMemberId,
        p_actor_name: actorName,
        p_action: 'appointment_scheduled',
        p_entity_type: 'case',
        p_entity_id: caseId,
        p_metadata: { scheduled_at: slot.toISOString() },
      });

      toast({ title: t('lawyer.appointmentScheduled') });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('[AppointmentScheduler]', err);
      toast({ variant: 'destructive', title: t('common.error'), description: readableError(err) });
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('lawyer.scheduleAppointment')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('lawyer.durationMin')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                    duration === d ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <AppointmentPicker
            teamMemberId={teamMemberId}
            value={slot}
            onChange={setSlot}
            durationMinutes={duration}
            onConflictChange={setConflict}
          />

          {conflict && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('lawyer.picker.conflict', 'This time overlaps another appointment')}
            </p>
          )}

          <div className="space-y-1">
            <Label className="text-xs">{t('lawyer.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('lawyer.optional')} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving || !slot || conflict}>
            {saving ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('common.loading')}</> : t('lawyer.schedule')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
