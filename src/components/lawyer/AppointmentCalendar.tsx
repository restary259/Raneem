import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface Appointment {
  id: string;
  case_id: string | null;
  lawyer_id: string;
  student_name: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface AppointmentCalendarProps {
  userId: string;
  cases: any[];
  leads: any[];
}

const AppointmentCalendar = ({ userId, cases, leads }: AppointmentCalendarProps) => {
  const { t, i18n } = useTranslation('dashboard');
  const dateFnsLocale = i18n.language === 'ar' ? ar : enUS;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAppt, setNewAppt] = useState({ case_id: '', student_name: '', scheduled_at: '', time: '10:00', duration_minutes: 30, location: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const getLeadName = (leadId: string) => leads.find((l: any) => l.id === leadId)?.full_name || t('admin.appointments.unknown');

  useEffect(() => { fetchAppointments(); }, [userId]);

  const fetchAppointments = async () => {
    const { data } = await (supabase as any).from('appointments').select('*').eq('lawyer_id', userId).order('scheduled_at', { ascending: true });
    if (data) setAppointments(data);
  };

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startDayOffset = useMemo(() => {
    const day = getDay(startOfMonth(currentMonth));
    return day === 0 ? 6 : day - 1;
  }, [currentMonth]);

  const getApptsForDay = (date: Date) => appointments.filter(a => isSameDay(new Date(a.scheduled_at), date));

  const selectedDayAppts = selectedDate ? getApptsForDay(selectedDate) : [];

  const handleCreate = async () => {
    if (!newAppt.student_name || !newAppt.scheduled_at || !newAppt.time) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('admin.appointments.requiredFields') });
      return;
    }
    setSaving(true);
    const scheduledAt = new Date(`${newAppt.scheduled_at}T${newAppt.time}:00`).toISOString();

    const { error } = await (supabase as any).from('appointments').insert({
      lawyer_id: userId,
      case_id: newAppt.case_id || null,
      student_name: newAppt.student_name,
      scheduled_at: scheduledAt,
      duration_minutes: newAppt.duration_minutes,
      location: newAppt.location || null,
      notes: newAppt.notes || null,
    });

    if (error) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    } else {
      toast({ title: t('admin.appointments.added') });
      setIsDialogOpen(false);
      setNewAppt({ case_id: '', student_name: '', scheduled_at: '', time: '10:00', duration_minutes: 30, location: '', notes: '' });
      await fetchAppointments();

      if (newAppt.case_id) {
        await (supabase as any).from('student_cases').update({ case_status: 'appointment' }).eq('id', newAppt.case_id);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from('appointments').delete().eq('id', id);
    if (!error) {
      toast({ title: t('admin.appointments.deleted') });
      await fetchAppointments();
    }
  };

  const handleCaseSelect = (caseId: string) => {
    const c = cases.find((cs: any) => cs.id === caseId);
    const name = c ? getLeadName(c.lead_id) : '';
    setNewAppt(prev => ({ ...prev, case_id: caseId, student_name: name }));
  };

  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" /> {t('admin.appointments.title')}
        </h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t('admin.appointments.newAppointment')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t('admin.appointments.addTitle')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t('admin.appointments.linkCase')}</Label>
                <Select value={newAppt.case_id} onValueChange={handleCaseSelect}>
                  <SelectTrigger><SelectValue placeholder={t('admin.appointments.selectCase')} /></SelectTrigger>
                  <SelectContent>
                    {cases.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{getLeadName(c.lead_id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t('admin.appointments.studentName')}</Label>
                <Input value={newAppt.student_name} onChange={e => setNewAppt(p => ({ ...p, student_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('admin.appointments.date')}</Label>
                  <Input type="date" value={newAppt.scheduled_at} onChange={e => setNewAppt(p => ({ ...p, scheduled_at: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{t('admin.appointments.time')}</Label>
                  <Input type="time" value={newAppt.time} onChange={e => setNewAppt(p => ({ ...p, time: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('admin.appointments.duration')}</Label>
                  <Input type="number" value={newAppt.duration_minutes} onChange={e => setNewAppt(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 30 }))} />
                </div>
                <div>
                  <Label className="text-xs">{t('admin.appointments.location')}</Label>
                  <Input value={newAppt.location} onChange={e => setNewAppt(p => ({ ...p, location: e.target.value }))} placeholder={t('admin.appointments.locationPlaceholder')} />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t('admin.appointments.notes')}</Label>
                <Textarea value={newAppt.notes} onChange={e => setNewAppt(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
              <Button onClick={handleCreate} disabled={saving} className="w-full">{saving ? t('admin.appointments.saving') : t('admin.appointments.addBtn')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
            <span className="font-bold text-sm">{format(currentMonth, 'MMMM yyyy', { locale: dateFnsLocale })}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {dayKeys.map(d => <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">{t(`admin.appointments.days.${d}`)}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startDayOffset }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => {
              const dayAppts = getApptsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`relative p-1.5 text-xs rounded-md transition-colors min-h-[2.5rem] ${
                    isSelected ? 'bg-primary text-primary-foreground' :
                    isToday ? 'bg-accent/20 font-bold' :
                    'hover:bg-muted'
                  }`}
                >
                  {format(day, 'd')}
                  {dayAppts.length > 0 && (
                    <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-orange-500'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDate && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            {t('admin.appointments.appointmentsFor', { date: format(selectedDate, 'd MMMM yyyy', { locale: dateFnsLocale }) })}
          </h3>
          {selectedDayAppts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">{t('admin.appointments.noAppointments')}</p>
          ) : (
            selectedDayAppts.map(appt => (
              <Card key={appt.id} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-bold text-sm">{appt.student_name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(appt.scheduled_at), 'HH:mm')}</span>
                        <span>{appt.duration_minutes} {t('admin.appointments.minutes')}</span>
                        {appt.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{appt.location}</span>}
                      </div>
                      {appt.notes && <p className="text-xs text-muted-foreground mt-1">{appt.notes}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(appt.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {!selectedDate && appointments.filter(a => new Date(a.scheduled_at) >= new Date()).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t('admin.appointments.upcoming')}</h3>
          {appointments
            .filter(a => new Date(a.scheduled_at) >= new Date())
            .slice(0, 5)
            .map(appt => (
              <Card key={appt.id} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{appt.student_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(appt.scheduled_at), 'd MMM - HH:mm', { locale: dateFnsLocale })}
                        {appt.location && ` • ${appt.location}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{appt.status === 'scheduled' ? t('admin.appointments.scheduled') : appt.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
};

export default AppointmentCalendar;
