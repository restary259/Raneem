import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, AlertTriangle } from 'lucide-react';
import { canTransition } from '@/lib/caseTransitions';
import { CaseStatus } from '@/lib/caseStatus';
import AppointmentPicker from './AppointmentPicker';
import { cn } from '@/lib/utils';

interface ScheduleDialogProps {
  scheduleForCase: any | null;
  leads?: any[];
  userId?: string;
  onClose: () => void;
  refetch: () => Promise<void>;
}

const DURATIONS = [15, 30, 45, 60, 90];

const ScheduleDialog: React.FC<ScheduleDialogProps> = ({ scheduleForCase, userId, onClose, refetch }) => {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  const [slot, setSlot] = useState<Date | null>(null);
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (scheduleForCase) {
      setSlot(null);
      setDuration(30);
      setLocation('');
      setNotes('');
      setConflict(false);
    }
  }, [scheduleForCase]);

  const handleCreate = async () => {
    if (!scheduleForCase || !slot || conflict) return;
    setSaving(true);
    try {
      const guestName = scheduleForCase.full_name || null;
      const scheduledAt = slot.toISOString();
      const combinedNotes = [location ? `${t('lawyer.location')}: ${location}` : null, notes || null]
        .filter(Boolean)
        .join(' — ') || null;

      const { data: existing } = await (supabase as any)
        .from('appointments').select('id')
        .eq('case_id', scheduleForCase.id).eq('team_member_id', userId).is('outcome', null).maybeSingle();

      if (existing) {
        const { error } = await (supabase as any).from('appointments').update({
          guest_name: guestName, scheduled_at: scheduledAt,
          duration_minutes: duration, notes: combinedNotes,
        }).eq('id', existing.id);
        if (error) throw error;
        toast({ title: t('lawyer.appointmentUpdated') });
      } else {
        const { error } = await (supabase as any).from('appointments').insert({
          team_member_id: userId, case_id: scheduleForCase.id, guest_name: guestName,
          scheduled_at: scheduledAt, duration_minutes: duration, notes: combinedNotes,
        });
        if (error) throw error;
        toast({ title: t('lawyer.appointmentScheduled') });
        if (canTransition(scheduleForCase.status, CaseStatus.APPT_SCHEDULED)) {
          await (supabase as any).from('cases').update({ status: CaseStatus.APPT_SCHEDULED }).eq('id', scheduleForCase.id);
        }
      }
      try { await refetch(); } catch { /* ignore */ }
      onClose();
    } catch (err) {
      console.error('[ScheduleDialog]', err);
      toast({ variant: 'destructive', title: t('common.error'), description: t('common.actionFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!scheduleForCase} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('lawyer.scheduleAppointment')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">{t('lawyer.student')}</p>
            <p className="text-sm font-semibold">{scheduleForCase ? (scheduleForCase.full_name || '—') : ''}</p>
          </div>

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
            teamMemberId={userId}
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

          <div>
            <Label className="text-xs">{t('lawyer.location')}</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('lawyer.optional')} />
          </div>
          <div>
            <Label className="text-xs">{t('lawyer.notes')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('lawyer.optional')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleCreate} disabled={saving || !slot || conflict}>
            <CalendarDays className="h-4 w-4 me-1" />{saving ? t('common.loading') : t('lawyer.schedule')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleDialog;
