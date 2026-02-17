import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addDays, subDays, addMonths, subMonths, getDay, isToday } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';

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

const HOUR_HEIGHT = 60; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23

const APPOINTMENT_COLORS = [
  'bg-blue-500/90 border-blue-600',
  'bg-emerald-500/90 border-emerald-600',
  'bg-purple-500/90 border-purple-600',
  'bg-orange-500/90 border-orange-600',
  'bg-pink-500/90 border-pink-600',
  'bg-cyan-500/90 border-cyan-600',
];

const AppointmentCalendar = ({ userId, cases, leads }: AppointmentCalendarProps) => {
  const { t, i18n } = useTranslation('dashboard');
  const dateFnsLocale = i18n.language === 'ar' ? ar : enUS;
  const isMobile = useIsMobile();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [miniCalMonth, setMiniCalMonth] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAppt, setNewAppt] = useState({ case_id: '', student_name: '', scheduled_at: '', time: '10:00', duration_minutes: 30, location: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const getLeadName = (leadId: string) => leads.find((l: any) => l.id === leadId)?.full_name || t('admin.appointments.unknown');

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { fetchAppointments(); }, [userId]);

  // Auto-scroll to current hour on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollTo = Math.max(0, (now.getHours() - 1) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  const fetchAppointments = async () => {
    const { data } = await (supabase as any).from('appointments').select('*').eq('lawyer_id', userId).order('scheduled_at', { ascending: true });
    if (data) setAppointments(data);
  };

  // Mini calendar data
  const miniCalDays = useMemo(() => {
    const start = startOfMonth(miniCalMonth);
    const end = endOfMonth(miniCalMonth);
    return eachDayOfInterval({ start, end });
  }, [miniCalMonth]);

  const miniCalOffset = useMemo(() => {
    const day = getDay(startOfMonth(miniCalMonth));
    return day === 0 ? 6 : day - 1;
  }, [miniCalMonth]);

  // Appointments for selected day – hide past-due ones for today
  const dayAppointments = useMemo(() => {
    const now = new Date();
    return appointments.filter(a => {
      if (!isSameDay(new Date(a.scheduled_at), selectedDate)) return false;
      // For today, hide appointments whose end time has passed
      if (isSameDay(selectedDate, now)) {
        const end = new Date(new Date(a.scheduled_at).getTime() + a.duration_minutes * 60000);
        return end > now;
      }
      return true;
    });
  }, [appointments, selectedDate]);

  // Upcoming appointments – only future (not past-due)
  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return appointments.filter(a => {
      const end = new Date(new Date(a.scheduled_at).getTime() + a.duration_minutes * 60000);
      return end > now && !isSameDay(new Date(a.scheduled_at), selectedDate);
    }).slice(0, 5);
  }, [appointments, selectedDate]);

  // Current time indicator position
  const currentTimeTop = useMemo(() => {
    if (!isSameDay(currentTime, selectedDate)) return null;
    return (currentTime.getHours() * HOUR_HEIGHT) + (currentTime.getMinutes() * (HOUR_HEIGHT / 60));
  }, [currentTime, selectedDate]);

  // Position appointment on grid
  const getApptStyle = (appt: Appointment) => {
    const d = new Date(appt.scheduled_at);
    const top = (d.getHours() * HOUR_HEIGHT) + (d.getMinutes() * (HOUR_HEIGHT / 60));
    const height = Math.max(appt.duration_minutes * (HOUR_HEIGHT / 60), 24);
    return { top: `${top}px`, height: `${height}px` };
  };

  const getApptColor = (index: number) => APPOINTMENT_COLORS[index % APPOINTMENT_COLORS.length];

  const handleCreate = async () => {
    if (!newAppt.student_name || !newAppt.scheduled_at || !newAppt.time) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('admin.appointments.requiredFields') });
      return;
    }
    setSaving(true);
    const scheduledAt = new Date(`${newAppt.scheduled_at}T${newAppt.time}:00`).toISOString();

    // If case_id is set, check for existing appointment and update instead of duplicate
    if (newAppt.case_id) {
      const { data: existing } = await (supabase as any)
        .from('appointments')
        .select('id')
        .eq('case_id', newAppt.case_id)
        .eq('lawyer_id', userId)
        .eq('status', 'scheduled')
        .maybeSingle();

      if (existing) {
        // Update existing appointment instead of creating duplicate
        const { error } = await (supabase as any).from('appointments').update({
          student_name: newAppt.student_name,
          scheduled_at: scheduledAt,
          duration_minutes: newAppt.duration_minutes,
          location: newAppt.location || null,
          notes: newAppt.notes || null,
        }).eq('id', existing.id);
        if (error) {
          toast({ variant: 'destructive', title: t('common.error'), description: error.message });
        } else {
          toast({ title: t('admin.appointments.added') });
          setIsDialogOpen(false);
          setNewAppt({ case_id: '', student_name: '', scheduled_at: '', time: '10:00', duration_minutes: 30, location: '', notes: '' });
          await fetchAppointments();
        }
        setSaving(false);
        return;
      }
    }

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
      // Auto-advance case to appointment_scheduled using FSM
      if (newAppt.case_id) {
        const { data: caseData } = await (supabase as any).from('student_cases').select('case_status').eq('id', newAppt.case_id).maybeSingle();
        if (caseData) {
          const { canTransition } = await import('@/lib/caseTransitions');
          if (canTransition(caseData.case_status, 'appointment_scheduled')) {
            await (supabase as any).from('student_cases').update({ case_status: 'appointment_scheduled' }).eq('id', newAppt.case_id);
          }
        }
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

  const goToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setMiniCalMonth(today);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, (today.getHours() - 1) * HOUR_HEIGHT);
    }
  };

  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

  const hasApptsOnDay = useCallback((day: Date) =>
    appointments.some(a => isSameDay(new Date(a.scheduled_at), day)),
    [appointments]
  );

  // ── Mini Calendar ──
  const renderMiniCalendar = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMiniCalMonth(subMonths(miniCalMonth, 1))}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="font-semibold text-xs">{format(miniCalMonth, 'MMMM yyyy', { locale: dateFnsLocale })}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMiniCalMonth(addMonths(miniCalMonth, 1))}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {dayKeys.map(d => (
          <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">
            {t(`admin.appointments.days.${d}`)}
          </div>
        ))}
        {Array.from({ length: miniCalOffset }).map((_, i) => <div key={`e-${i}`} />)}
        {miniCalDays.map(day => {
          const hasAppts = hasApptsOnDay(day);
          const isSel = isSameDay(day, selectedDate);
          const isT = isToday(day);
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={`relative text-[11px] p-1 rounded-full w-7 h-7 mx-auto flex items-center justify-center transition-colors ${
                isSel ? 'bg-primary text-primary-foreground font-bold' :
                isT ? 'bg-accent text-accent-foreground font-bold' :
                'hover:bg-muted'
              }`}
            >
              {format(day, 'd')}
              {hasAppts && !isSel && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Upcoming List ──
  const renderUpcoming = () => (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t('admin.appointments.upcoming')}
      </h4>
      {upcomingAppointments.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('admin.appointments.noAppointments')}</p>
      ) : (
        upcomingAppointments.map(appt => (
          <div key={appt.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="w-1 h-8 rounded-full bg-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{appt.student_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(appt.scheduled_at), 'd MMM · HH:mm', { locale: dateFnsLocale })}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ── Day View Header ──
  const renderDayHeader = () => (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="text-xs h-8 active:scale-95" onClick={goToday}>
          {t('admin.appointments.today', 'Today')}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="font-bold text-sm sm:text-base">
          {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: dateFnsLocale })}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs whitespace-nowrap">
          {t('admin.appointments.dayView', 'Day')}
        </Badge>
      </div>
    </div>
  );

  // ── Hourly Time Grid ──
  const renderDayView = () => (
    <div className="flex-1 flex flex-col bg-card rounded-xl border overflow-hidden">
      {renderDayHeader()}
      <div ref={scrollRef} className="flex-1 overflow-auto relative" style={{ maxHeight: isMobile ? 'calc(100vh - 280px)' : 'calc(100vh - 220px)' }}>
        <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          {/* Hour rows */}
          {HOURS.map(hour => (
            <div key={hour} className="absolute w-full flex" style={{ top: `${hour * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}>
              {/* Time label */}
              <div className="w-16 shrink-0 pe-2 text-end">
                <span className="text-[10px] text-muted-foreground -mt-2 block">
                  {hour === 0 ? '' : format(new Date(2000, 0, 1, hour), 'h a')}
                </span>
              </div>
              {/* Grid line */}
              <div className="flex-1 border-t border-muted/40" />
            </div>
          ))}

          {/* Current time indicator */}
          {currentTimeTop !== null && (
            <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${currentTimeTop}px` }}>
              <div className="flex items-center">
                <div className="w-16 flex justify-end pe-1">
                  <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1 rounded">
                    {format(currentTime, 'HH:mm')}
                  </span>
                </div>
                <div className="relative flex-1">
                  <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <div className="h-[2px] bg-red-500 w-full" />
                </div>
              </div>
            </div>
          )}

          {/* Appointment blocks */}
          {dayAppointments.map((appt, idx) => {
            const style = getApptStyle(appt);
            const colorClass = getApptColor(idx);
            return (
              <div
                key={appt.id}
                className={`absolute left-16 right-2 z-10 rounded-lg border-l-4 px-2 py-1 text-white cursor-pointer group transition-shadow hover:shadow-lg ${colorClass}`}
                style={{ top: style.top, height: style.height, minHeight: '24px' }}
              >
                <div className="flex items-start justify-between h-full">
                  <div className="min-w-0 overflow-hidden">
                    <p className="text-xs font-bold truncate">{appt.student_name}</p>
                    <p className="text-[10px] opacity-90">
                      {format(new Date(appt.scheduled_at), 'HH:mm')} – {format(new Date(new Date(appt.scheduled_at).getTime() + appt.duration_minutes * 60000), 'HH:mm')}
                      {appt.location && ` · ${appt.location}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:text-white hover:bg-white/20 shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleDelete(appt.id); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── Create Dialog ──
  const renderCreateDialog = () => (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs mb-1 block">{t('admin.appointments.date')}</Label>
              <Input type="date" value={newAppt.scheduled_at} onChange={e => setNewAppt(p => ({ ...p, scheduled_at: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">{t('admin.appointments.time')}</Label>
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
  );

  return (
    <div className="space-y-0 h-full">
      {/* Mobile: mini calendar + upcoming */}
      {isMobile && (
        <>
          <Card className="mb-3">
            <CardContent className="p-3">
              {renderMiniCalendar()}
            </CardContent>
          </Card>
          {upcomingAppointments.length > 0 && (
            <Card className="mb-3">
              <CardContent className="p-3">
                {renderUpcoming()}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="flex gap-4 h-full">
        {/* Desktop sidebar */}
        {!isMobile && (
          <div className="w-56 shrink-0 space-y-4">
            <Button className="w-full gap-2 shadow-md active:scale-95" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4" /> {t('admin.appointments.newAppointment')}
            </Button>
            <Card>
              <CardContent className="p-3">
                {renderMiniCalendar()}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                {renderUpcoming()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Day view */}
        <div className="flex-1 min-w-0">
          {renderDayView()}
        </div>
      </div>

      {/* Mobile FAB - positioned above bottom nav */}
      {isMobile && (
        <button
          onClick={() => setIsDialogOpen(true)}
          className="fixed bottom-24 end-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform hover:shadow-xl"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {renderCreateDialog()}
    </div>
  );
};

export default AppointmentCalendar;
