import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays } from 'lucide-react';
import { canTransition } from '@/lib/caseTransitions';
import { CaseStatus } from '@/lib/caseStatus';
import { format } from 'date-fns';

interface ScheduleDialogProps {
  scheduleForCase: any | null;
  leads: any[];
  userId?: string;
  onClose: () => void;
  refetch: () => Promise<void>;
}

const ScheduleDialog: React.FC<ScheduleDialogProps> = ({ scheduleForCase, leads, userId, onClose, refetch }) => {
  const { toast } = useToast();
  const { i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';
  const { t } = useTranslation('dashboard');

  const [scheduleDate, setScheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduleTime, setScheduleTime] = useState('10:00');
  const [scheduleDuration, setScheduleDuration] = useState(30);
  const [scheduleLocation, setScheduleLocation] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (scheduleForCase) {
      setScheduleDate(format(new Date(), 'yyyy-MM-dd'));
      setScheduleTime('10:00');
      setScheduleDuration(30);
      setScheduleLocation('');
      setScheduleNotes('');
    }
  }, [scheduleForCase]);

  const getLeadInfo = (leadId: string) => leads.find(l => l.id === leadId) || { full_name: 'Unknown', phone: '' };

  const handleCreate = async () => {
    if (!scheduleForCase || !scheduleDate || !scheduleTime) return;
    setSaving(true);
    try {
      const lead = getLeadInfo(scheduleForCase.lead_id);
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();

      const { data: existing } = await (supabase as any)
        .from('appointments').select('id')
        .eq('case_id', scheduleForCase.id).eq('lawyer_id', userId).eq('status', 'scheduled').maybeSingle();

      if (existing) {
        const { error } = await (supabase as any).from('appointments').update({
          student_name: lead.full_name || 'Unknown', scheduled_at: scheduledAt,
          duration_minutes: scheduleDuration, location: scheduleLocation || null, notes: scheduleNotes || null,
        }).eq('id', existing.id);
        if (error) toast({ variant: 'destructive', title: t('common.error'), description: error.message });
        else toast({ title: isAr ? 'تم تحديث الموعد' : 'Appointment updated' });
      } else {
        const { error } = await (supabase as any).from('appointments').insert({
          lawyer_id: userId, case_id: scheduleForCase.id, student_name: lead.full_name || 'Unknown',
          scheduled_at: scheduledAt, duration_minutes: scheduleDuration,
          location: scheduleLocation || null, notes: scheduleNotes || null,
        });
        if (error) toast({ variant: 'destructive', title: t('common.error'), description: error.message });
        else {
          toast({ title: isAr ? 'تم حجز الموعد' : 'Appointment scheduled' });
          if (canTransition(scheduleForCase.case_status, CaseStatus.APPT_SCHEDULED)) {
            await (supabase as any).from('student_cases').update({ case_status: CaseStatus.APPT_SCHEDULED }).eq('id', scheduleForCase.id);
          }
        }
      }
      try { await refetch(); } catch {}
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast({ variant: 'destructive', title: t('common.error'), description: err?.message || 'Unexpected error' });
    } finally {
      onClose();
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!scheduleForCase} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isAr ? 'حجز موعد' : 'Schedule Appointment'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">{isAr ? 'الطالب' : 'Student'}</p>
            <p className="text-sm font-semibold">{scheduleForCase ? getLeadInfo(scheduleForCase.lead_id).full_name : ''}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">{isAr ? 'التاريخ' : 'Date'}</Label><Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} /></div>
            <div><Label className="text-xs">{isAr ? 'الوقت' : 'Time'}</Label><Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">{isAr ? 'المدة (دقيقة)' : 'Duration (min)'}</Label><Input type="number" value={scheduleDuration} onChange={e => setScheduleDuration(parseInt(e.target.value) || 30)} /></div>
            <div><Label className="text-xs">{isAr ? 'الموقع' : 'Location'}</Label><Input value={scheduleLocation} onChange={e => setScheduleLocation(e.target.value)} placeholder={isAr ? 'اختياري' : 'Optional'} /></div>
          </div>
          <div><Label className="text-xs">{isAr ? 'ملاحظات' : 'Notes'}</Label><Textarea value={scheduleNotes} onChange={e => setScheduleNotes(e.target.value)} rows={2} placeholder={isAr ? 'اختياري' : 'Optional'} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleCreate} disabled={saving || !scheduleDate || !scheduleTime}>
            <CalendarDays className="h-4 w-4 me-1" />{saving ? t('common.loading') : (isAr ? 'حجز' : 'Schedule')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleDialog;
