import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import AppointmentPicker from './AppointmentPicker';

interface RescheduleDialogProps {
  appointment: any | null;
  onClose: () => void;
  refetch: () => Promise<void>;
}

const RescheduleDialog: React.FC<RescheduleDialogProps> = ({ appointment, onClose, refetch }) => {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const [slot, setSlot] = useState<Date | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (appointment) {
      setSlot(new Date(appointment.scheduled_at));
      setConflict(false);
    }
  }, [appointment]);

  const handleReschedule = async () => {
    if (!appointment || !slot || conflict) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('appointments')
        .update({ scheduled_at: slot.toISOString() })
        .eq('id', appointment.id);
      if (error) throw error;
      toast({ title: t('lawyer.appointmentRescheduled') });
      onClose();
      try { await refetch(); } catch { /* ignore */ }
    } catch (err) {
      console.error('[RescheduleDialog]', err);
      toast({ variant: 'destructive', title: t('common.error'), description: t('common.actionFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!appointment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t('lawyer.rescheduleAppointment')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <AppointmentPicker
            teamMemberId={appointment?.team_member_id}
            value={slot}
            onChange={setSlot}
            durationMinutes={appointment?.duration_minutes || 30}
            ignoreAppointmentId={appointment?.id}
            onConflictChange={setConflict}
          />
          {conflict && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('lawyer.picker.conflict', 'This time overlaps another appointment')}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleReschedule} disabled={saving || !slot || conflict}>
            {saving ? t('common.loading') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RescheduleDialog;
