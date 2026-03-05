import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, addWeeks, subWeeks, isToday, parseISO, getHours
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Loader2, CalendarIcon, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AppointmentOutcomeModal from '@/components/team/AppointmentOutcomeModal';

interface Appointment {
  id: string;
  case_id: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
  outcome: string | null;
  case?: { full_name: string; phone_number: string; status: string };
}

interface Case { id: string; full_name: string; phone_number: string; }

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8am - 8pm

export default function TeamAppointmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [outcomeApptId, setOutcomeApptId] = useState<string | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  // New appointment modal
  const [showNew, setShowNew] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newTime, setNewTime] = useState('10:00');
  const [newDuration, setNewDuration] = useState('60');
  const [newNotes, setNewNotes] = useState('');
  const [newCaseId, setNewCaseId] = useState('');
  const [myCases, setMyCases] = useState<Case[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchAppts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Load ALL appointments for this team member (no date restriction)
    // The weekly grid will display those in the visible week; navigating loads all
    const { data } = await supabase
      .from('appointments')
      .select('*, case:cases(full_name, phone_number, status)')
      .eq('team_member_id', user.id)
      .order('scheduled_at');
    setAppts((data as any[]) ?? []);
    setLoading(false);
  }, [user]);

  const fetchMyCases = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('cases').select('id, full_name, phone_number').eq('assigned_to', user.id).order('full_name');
    setMyCases((data as Case[]) ?? []);
  }, [user]);

  useEffect(() => { fetchAppts(); }, [fetchAppts]);
  useEffect(() => { fetchMyCases(); }, [fetchMyCases]);

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek, { weekStartsOn: 0 }),
    end: endOfWeek(currentWeek, { weekStartsOn: 0 }),
  });

  const getApptsForSlot = (day: Date, hour: number) =>
    appts.filter(a => {
      const d = parseISO(a.scheduled_at);
      return isSameDay(d, day) && getHours(d) === hour;
    });

  const handleCreateAppointment = async () => {
    if (!newCaseId || !newDate) {
      toast({ variant: 'destructive', description: isAr ? 'يرجى تحديد الملف والتاريخ' : 'Please select case and date' });
      return;
    }
    setCreating(true);
    try {
      const [hh, mm] = newTime.split(':').map(Number);
      const dt = new Date(newDate);
      dt.setHours(hh, mm, 0, 0);

      const { error } = await supabase.from('appointments').insert({
        case_id: newCaseId,
        team_member_id: user!.id,
        scheduled_at: dt.toISOString(),
        duration_minutes: parseInt(newDuration),
        notes: newNotes || null,
      });
      if (error) throw error;

      // Move case status to appointment_scheduled
      await supabase.from('cases').update({ status: 'appointment_scheduled' }).eq('id', newCaseId).eq('status', 'contacted');

      toast({ title: isAr ? 'تم إنشاء الموعد' : 'Appointment created' });
      setShowNew(false);
      setNewDate(undefined); setNewTime('10:00'); setNewNotes(''); setNewCaseId('');
      fetchAppts();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const outcomeColor = (outcome: string | null) => {
    if (!outcome) return 'bg-primary/10 text-primary border-primary/30';
    if (outcome === 'completed') return 'bg-green-100 text-green-800 border-green-200';
    if (outcome === 'no_show') return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-muted text-muted-foreground border-border';
  };

  const weekLabel = `${format(weekDays[0], 'MMM d')} – ${format(weekDays[6], 'MMM d, yyyy')}`;

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(w => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">{weekLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(w => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setCurrentWeek(new Date())}>
            {isAr ? 'هذا الأسبوع' : 'This Week'}
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 me-1" />
          {isAr ? 'موعد جديد' : 'New Appointment'}
        </Button>
      </div>

      {/* Week Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-background z-10">
            <div className="py-2 px-2 text-xs text-muted-foreground border-e border-border" />
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className={cn(
                  'py-2 px-1 text-center border-e border-border last:border-e-0',
                  isToday(day) && 'bg-primary/5'
                )}
              >
                <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                <div className={cn(
                  'text-sm font-medium mx-auto w-7 h-7 flex items-center justify-center rounded-full mt-0.5',
                  isToday(day) && 'bg-primary text-primary-foreground'
                )}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* Hour rows */}
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-border/50 min-h-[60px]">
              <div className="py-1 px-2 text-xs text-muted-foreground border-e border-border flex items-start pt-2 shrink-0">
                {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
              </div>
              {weekDays.map(day => {
                const slotAppts = getApptsForSlot(day, hour);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'border-e border-border/50 last:border-e-0 p-0.5 relative cursor-pointer hover:bg-muted/30 transition-colors',
                      isToday(day) && 'bg-primary/3'
                    )}
                    onClick={() => {
                      const d = new Date(day);
                      d.setHours(hour, 0, 0, 0);
                      setNewDate(d);
                      setNewTime(`${String(hour).padStart(2, '0')}:00`);
                      setShowNew(true);
                    }}
                  >
                    {slotAppts.map(a => (
                      <div
                        key={a.id}
                        onClick={e => { e.stopPropagation(); setSelectedAppt(a); }}
                        className={cn(
                          'text-[10px] p-1 rounded mb-0.5 cursor-pointer border leading-tight',
                          outcomeColor(a.outcome)
                        )}
                      >
                        <div className="font-medium truncate">{(a.case as any)?.full_name ?? '—'}</div>
                        <div className="flex items-center gap-0.5 opacity-70">
                          <Clock className="h-2.5 w-2.5" />
                          {format(parseISO(a.scheduled_at), 'h:mm a')}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* New Appointment Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isAr ? 'موعد جديد' : 'New Appointment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isAr ? 'الملف *' : 'Case *'}</Label>
              <Select value={newCaseId} onValueChange={setNewCaseId}>
                <SelectTrigger>
                  <SelectValue placeholder={isAr ? 'اختر الملف' : 'Select case'} />
                </SelectTrigger>
                <SelectContent>
                  {myCases.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name} — {c.phone_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isAr ? 'التاريخ *' : 'Date *'}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !newDate && 'text-muted-foreground')}>
                      <CalendarIcon className="me-2 h-4 w-4" />
                      {newDate ? format(newDate, 'PP') : (isAr ? 'اختر' : 'Pick')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newDate}
                      onSelect={setNewDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>{isAr ? 'الوقت *' : 'Time *'}</Label>
                <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>{isAr ? 'المدة (دقائق)' : 'Duration (minutes)'}</Label>
              <Select value={newDuration} onValueChange={setNewDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['30', '45', '60', '90', '120'].map(d => (
                    <SelectItem key={d} value={d}>{d} {isAr ? 'دقيقة' : 'min'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{isAr ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder={isAr ? 'ملاحظات اختيارية...' : 'Optional notes...'}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleCreateAppointment} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'إنشاء' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={!!selectedAppt} onOpenChange={() => setSelectedAppt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{(selectedAppt?.case as any)?.full_name ?? '—'}</DialogTitle>
          </DialogHeader>
          {selectedAppt && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                {format(parseISO(selectedAppt.scheduled_at), 'PPP p')}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {selectedAppt.duration_minutes} {isAr ? 'دقيقة' : 'minutes'}
              </div>
              {selectedAppt.notes && <p className="text-muted-foreground">{selectedAppt.notes}</p>}
              {selectedAppt.outcome && (
                <Badge className={outcomeColor(selectedAppt.outcome)}>{selectedAppt.outcome}</Badge>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => navigate(`/team/cases/${selectedAppt?.case_id}`)}>
              {isAr ? 'عرض الملف' : 'View Case'}
            </Button>
            {selectedAppt && !selectedAppt.outcome && new Date(selectedAppt.scheduled_at) < new Date() && (
              <Button variant="destructive" onClick={() => { setOutcomeApptId(selectedAppt.id); setSelectedAppt(null); }}>
                {isAr ? 'تسجيل النتيجة' : 'Record Outcome'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {outcomeApptId && (
        <AppointmentOutcomeModal
          open={!!outcomeApptId}
          onClose={() => setOutcomeApptId(null)}
          appointmentId={outcomeApptId}
          onSuccess={fetchAppts}
        />
      )}
    </div>
  );
}
