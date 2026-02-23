import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface RescheduleDialogProps {
  appointment: any | null;
  onClose: () => void;
  refetch: () => Promise<void>;
}

const RescheduleDialog: React.FC<RescheduleDialogProps> = ({ appointment, onClose, refetch }) => {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (appointment) {
      const d = new Date(appointment.scheduled_at);
      setDate(format(d, 'yyyy-MM-dd'));
      setTime(format(d, 'HH:mm'));
    }
  }, [appointment]);

  const handleReschedule = async () => {
    if (!appointment || !date || !time) return;
    setSaving(true);
    try {
      const newScheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const { error } = await (supabase as any).from('appointments').update({ scheduled_at: newScheduledAt }).eq('id', appointment.id);
      if (!error) {
        toast({ title: t('lawyer.appointmentRescheduled') });
        onClose();
        try { await refetch(); } catch {}
      } else {
        toast({ variant: 'destructive', title: t('common.error'), description: error.message });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast({ variant: 'destructive', title: t('common.error'), description: err?.message || 'Unexpected error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!appointment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('lawyer.rescheduleAppointment')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">{t('lawyer.newDate')}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label className="text-xs">{t('lawyer.newTime')}</Label><Input type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleReschedule} disabled={saving || !date || !time}>{saving ? t('common.loading') : t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RescheduleDialog;
