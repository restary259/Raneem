
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useDirection } from '@/hooks/useDirection';
import { useTranslation } from 'react-i18next';
import { User } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Phone, LogOut, ArrowLeftCircle, Save, Briefcase,
  CheckCircle, XCircle, AlertTriangle, CalendarDays, Users, CreditCard,
  Home, Calendar, DollarSign, TrendingUp, BarChart3, Send, FileText, Trash2, UserX
} from 'lucide-react';
import AppointmentCalendar from '@/components/lawyer/AppointmentCalendar';
import EarningsPanel from '@/components/influencer/EarningsPanel';
import NotificationBell from '@/components/common/NotificationBell';

import { differenceInHours, isToday, format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import PullToRefresh from '@/components/common/PullToRefresh';

import { STATUS_COLORS as IMPORTED_STATUS_COLORS, resolveStatus, CaseStatus } from '@/lib/caseStatus';
import { canTransition } from '@/lib/caseTransitions';

const ACCOMMODATION_OPTIONS = ['dorm', 'private_apartment', 'shared_flat', 'homestay', 'other'];
const LANGUAGE_SCHOOLS = ['F+U Academy of Languages', 'Alpha Aktiv', 'GO Academy', 'VICTORIA Academy'];

type TabId = 'cases' | 'appointments' | 'analytics' | 'earnings';

const TAB_CONFIG: { id: TabId; icon: React.ComponentType<{ className?: string }>; labelKey: string }[] = [
  { id: 'cases', icon: Home, labelKey: 'lawyer.tabs.cases' },
  { id: 'appointments', icon: Calendar, labelKey: 'lawyer.tabs.appointments' },
  { id: 'analytics', icon: BarChart3, labelKey: 'lawyer.tabs.analytics' },
  { id: 'earnings', icon: DollarSign, labelKey: 'lawyer.tabs.earnings' },
];

// Neon border colors per stage filter
const NEON_BORDERS: Record<string, string> = {
  all: 'border-white/30',
  new: 'border-[hsl(217,100%,60%)] shadow-[0_0_6px_hsl(217,100%,60%/0.3)]',
  contacted: 'border-[hsl(50,100%,50%)] shadow-[0_0_6px_hsl(50,100%,50%/0.3)]',
  appointment_stage: 'border-[hsl(270,100%,65%)] shadow-[0_0_6px_hsl(270,100%,65%/0.3)]',
  profile_filled: 'border-[hsl(140,70%,50%)] shadow-[0_0_6px_hsl(140,70%,50%/0.3)]',
  submitted: 'border-[hsl(185,100%,50%)] shadow-[0_0_6px_hsl(185,100%,50%/0.3)]',
  sla: 'border-[hsl(0,100%,55%)] shadow-[0_0_6px_hsl(0,100%,55%/0.3)]',
};

// Map case_status to the correct neon border
function getNeonBorder(status: string): string {
  if (['new', 'eligible'].includes(status)) return NEON_BORDERS.new;
  if (status === 'contacted') return NEON_BORDERS.contacted;
  if (['appointment_scheduled', 'appointment_waiting', 'appointment_completed', 'assigned'].includes(status)) return NEON_BORDERS.appointment_stage;
  if (['profile_filled', 'services_filled'].includes(status)) return NEON_BORDERS.profile_filled;
  if (['paid', 'ready_to_apply', 'visa_stage', 'completed'].includes(status)) return NEON_BORDERS.submitted;
  return NEON_BORDERS.all;
}

type CaseFilterTab = 'all' | 'new' | 'contacted' | 'appointment_stage' | 'profile_filled' | 'submitted' | 'sla';
const CASE_FILTER_TABS: CaseFilterTab[] = ['all', 'new', 'contacted', 'appointment_stage', 'profile_filled', 'submitted', 'sla'];

const FILTER_LABELS: Record<CaseFilterTab, { ar: string; en: string }> = {
  all: { ar: 'الكل', en: 'All' },
  new: { ar: 'جديد', en: 'New' },
  contacted: { ar: 'تم التواصل', en: 'Contacted' },
  appointment_stage: { ar: 'مرحلة الموعد', en: 'Appointments' },
  profile_filled: { ar: 'ملفات مكتملة', en: 'Completed Files' },
  submitted: { ar: 'تم الإرسال للمسؤول', en: 'Submitted' },
  sla: { ar: 'تنبيه SLA', en: 'SLA Alert' },
};

function matchesFilter(status: string, filter: CaseFilterTab): boolean {
  if (filter === 'all') return true;
  if (filter === 'new') return ['new', 'eligible'].includes(status);
  if (filter === 'contacted') return status === 'contacted';
  if (filter === 'appointment_stage') return ['assigned', 'appointment_scheduled', 'appointment_waiting', 'appointment_completed'].includes(status);
  if (filter === 'profile_filled') return ['profile_filled', 'services_filled'].includes(status);
  if (filter === 'submitted') return ['paid', 'ready_to_apply', 'visa_stage', 'completed'].includes(status);
  return false;
}

const TeamDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('cases');
  const [caseFilter, setCaseFilter] = useState<CaseFilterTab>('all');

  const [profileCase, setProfileCase] = useState<any | null>(null);
  const [profileValues, setProfileValues] = useState<Record<string, any>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [paymentConfirm, setPaymentConfirm] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [rescheduleAppt, setRescheduleAppt] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [completeFileConfirm, setCompleteFileConfirm] = useState(false);
  const [pendingUpdateData, setPendingUpdateData] = useState<Record<string, any> | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { dir } = useDirection();
  const { t, i18n } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const isAr = i18n.language === 'ar';

  const refetchAll = useCallback(() => {
    if (user) {
      fetchCases(user.id);
      fetchAppointments(user.id);
    }
  }, [user]);

  useRealtimeSubscription('student_cases', refetchAll, !!user);
  useRealtimeSubscription('appointments', refetchAll, !!user);
  useRealtimeSubscription('leads', refetchAll, !!user);
  useRealtimeSubscription('commissions', refetchAll, !!user);
  useRealtimeSubscription('payout_requests', refetchAll, !!user);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate('/student-auth'); return; }
      setUser(session.user);

      const { data: roles } = await (supabase as any)
        .from('user_roles').select('role').eq('user_id', session.user.id).eq('role', 'lawyer');
      if (!roles?.length) {
        toast({ variant: 'destructive', title: t('lawyer.unauthorized'), description: t('lawyer.unauthorizedDesc') });
        navigate('/'); return;
      }

      const { data: prof } = await (supabase as any).from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (prof) setProfile(prof);

      await fetchCases(session.user.id);
      await fetchAppointments(session.user.id);
      setIsLoading(false);
    };
    init();
  }, [navigate, toast]);

  const fetchCases = async (userId: string) => {
    const { data: casesData } = await (supabase as any)
      .from('student_cases').select('*').eq('assigned_lawyer_id', userId).order('created_at', { ascending: false });
    if (casesData) {
      setCases(casesData);
      const leadIds = [...new Set(casesData.map((c: any) => c.lead_id))];
      if (leadIds.length > 0) {
        const { data: leadsData } = await (supabase as any).from('leads').select('id, full_name, phone, email, eligibility_score, eligibility_reason, source_type, source_id, passport_type, english_units, math_units, last_contacted, created_at, preferred_major').in('id', leadIds);
        if (leadsData) setLeads(leadsData);
      }
    }
  };

  const fetchAppointments = async (userId: string) => {
    const { data } = await (supabase as any).from('appointments').select('*').eq('lawyer_id', userId).order('scheduled_at', { ascending: true });
    if (data) setAppointments(data);
  };

  const getLeadInfo = (leadId: string) => leads.find(l => l.id === leadId) || { full_name: t('lawyer.unknown'), phone: '' };

  const isSlaBreached = (c: any) => {
    if (c.case_status !== 'assigned') return false;
    const lead = leads.find(l => l.id === c.lead_id);
    if (lead?.last_contacted) return false;
    return differenceInHours(new Date(), new Date(c.created_at)) > 24;
  };

  const kpis = useMemo(() => {
    const activeLeads = cases.filter(c => !['paid', 'settled', 'completed'].includes(c.case_status)).length;
    const now = new Date();
    const todayAppts = appointments.filter(a => {
      if (!isToday(new Date(a.scheduled_at))) return false;
      if (a.status === 'cancelled' || a.status === 'deleted' || a.status === 'completed') return false;
      const end = new Date(new Date(a.scheduled_at).getTime() + (a.duration_minutes || 30) * 60000);
      return end > now;
    }).length;
    const paidThisMonth = cases.filter(c => {
      if (!c.paid_at) return false;
      const d = new Date(c.paid_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const slaWarnings = cases.filter(c => isSlaBreached(c)).length;
    const totalEarnings = cases.filter(c => c.paid_at).reduce((s, c) => s + (Number(c.lawyer_commission) || 0), 0);
    const totalServiceFees = cases.filter(c => c.paid_at).reduce((s, c) => s + (Number(c.service_fee) || 0), 0);
    const conversionRate = cases.length > 0 ? Math.round((cases.filter(c => c.paid_at).length / cases.length) * 100) : 0;
    // Show rate: only count past appointments (not future ones)
    const pastAppts = appointments.filter(a => new Date(a.scheduled_at) < now);
    const bookedPast = pastAppts.filter(a => a.status === 'scheduled' || a.status === 'completed').length;
    const completedAppts = pastAppts.filter(a => a.status === 'completed').length;
    const showRate = bookedPast > 0 ? Math.round((completedAppts / bookedPast) * 100) : 0;
    return { activeLeads, todayAppts, paidThisMonth, slaWarnings, totalEarnings, totalServiceFees, conversionRate, showRate };
  }, [cases, leads, appointments]);

  const filteredCases = useMemo(() => {
    if (caseFilter === 'sla') return cases.filter(c => isSlaBreached(c));
    return cases.filter(c => matchesFilter(c.case_status, caseFilter));
  }, [cases, caseFilter, leads]);

  // ── ACTIONS ──

  const handleMarkContacted = async (leadId: string, caseId: string) => {
    const now = new Date().toISOString();
    await (supabase as any).from('leads').update({ last_contacted: now }).eq('id', leadId);
    const caseItem = cases.find(c => c.id === caseId);
    if (caseItem && canTransition(caseItem.case_status, CaseStatus.CONTACTED)) {
      await (supabase as any).from('student_cases').update({ case_status: 'contacted' }).eq('id', caseId);
    }
    // Audit log
    await (supabase as any).rpc('log_user_activity', { p_action: 'mark_contacted', p_target_id: caseId, p_target_table: 'student_cases' });
    toast({ title: t('lawyer.contactLogged') });
    if (user) await fetchCases(user.id);
  };

  const handleMakeAppointment = (caseId: string) => {
    setActiveTab('appointments');
    // The AppointmentCalendar will handle creating with case link
    toast({ title: isAr ? 'انتقل لصفحة المواعيد لإنشاء موعد' : 'Switch to Appointments tab to create' });
  };

  const openProfileModal = (c: any) => {
    const lead = getLeadInfo(c.lead_id);
    setProfileCase(c);
    setProfileValues({
      student_full_name: c.student_full_name || lead.full_name || '',
      student_email: c.student_email || (lead as any).email || '',
      student_phone: c.student_phone || lead.phone || '',
      student_address: c.student_address || '',
      student_age: c.student_age || '',
      language_proficiency: c.language_proficiency || '',
      intensive_course: c.intensive_course || '',
      passport_number: c.passport_number || '',
      nationality: c.nationality || '',
      country_of_birth: c.country_of_birth || '',
      selected_city: c.selected_city || '',
      selected_school: c.selected_school || '',
      accommodation_status: c.accommodation_status || '',
      gender: c.gender || '',
      notes: c.notes || '',
    });
  };

  const saveProfileCompletion = async () => {
    if (!profileCase) return;
    setSavingProfile(true);
    const updateData: Record<string, any> = {
      student_full_name: profileValues.student_full_name || null,
      student_email: profileValues.student_email || null,
      student_phone: profileValues.student_phone || null,
      student_address: profileValues.student_address || null,
      student_age: profileValues.student_age ? Number(profileValues.student_age) : null,
      language_proficiency: profileValues.language_proficiency || null,
      intensive_course: profileValues.intensive_course || null,
      passport_number: profileValues.passport_number || null,
      nationality: profileValues.nationality || null,
      country_of_birth: profileValues.country_of_birth || null,
      selected_city: profileValues.selected_city || null,
      selected_school: profileValues.selected_school || null,
      accommodation_status: profileValues.accommodation_status || null,
      gender: profileValues.gender || null,
      notes: profileValues.notes || null,
    };

    const requiredProfileFields = [
      'student_full_name', 'student_email', 'student_phone', 'student_age', 'student_address',
      'passport_number', 'nationality', 'country_of_birth', 'language_proficiency',
      'gender', 'selected_city', 'selected_school', 'intensive_course', 'accommodation_status'
    ];
    const missingFields = requiredProfileFields.filter(f => {
      const val = profileValues[f];
      return !val || String(val).trim() === '' || String(val).trim() === 'null';
    });
    
    if (missingFields.length > 0) {
      const fieldLabels: Record<string, string> = {
        student_full_name: isAr ? 'الاسم الكامل' : 'Full Name',
        student_email: isAr ? 'البريد الإلكتروني' : 'Email',
        student_phone: isAr ? 'الهاتف' : 'Phone',
        student_age: isAr ? 'العمر' : 'Age',
        student_address: isAr ? 'العنوان' : 'Address',
        passport_number: isAr ? 'رقم الجواز' : 'Passport',
        nationality: isAr ? 'الجنسية' : 'Nationality',
        country_of_birth: isAr ? 'بلد الولادة' : 'Country of Birth',
        language_proficiency: isAr ? 'مستوى اللغة' : 'Language Level',
        gender: isAr ? 'الجنس' : 'Gender',
        selected_city: isAr ? 'المدينة' : 'City',
        selected_school: isAr ? 'المدرسة' : 'School',
        intensive_course: isAr ? 'دورة مكثفة' : 'Intensive Course',
        accommodation_status: isAr ? 'السكن' : 'Accommodation',
      };
      const missing = missingFields.map(f => fieldLabels[f] || f).join(', ');
      toast({ variant: 'destructive', title: isAr ? 'حقول مفقودة' : 'Missing Fields', description: missing });
      setSavingProfile(false);
      return;
    }

    // All fields filled — show confirmation dialog before moving
    setPendingUpdateData(updateData);
    setSavingProfile(false);
    setCompleteFileConfirm(true);
  };

  const confirmCompleteFile = async () => {
    if (!profileCase || !pendingUpdateData) return;
    setSavingProfile(true);
    const finalData = { ...pendingUpdateData };
    // Always transition to profile_filled when user confirms completion
    const appointmentStatuses = ['appointment_scheduled', 'appointment_waiting', 'appointment_completed', 'assigned', 'contacted'];
    if (canTransition(profileCase.case_status, CaseStatus.PROFILE_FILLED)) {
      finalData.case_status = CaseStatus.PROFILE_FILLED;
    } else if (appointmentStatuses.includes(profileCase.case_status)) {
      // Fallback: force transition for appointment-stage cases
      finalData.case_status = CaseStatus.PROFILE_FILLED;
    }
    const { error } = await (supabase as any).from('student_cases').update(finalData).eq('id', profileCase.id);
    setSavingProfile(false);
    setCompleteFileConfirm(false);
    setPendingUpdateData(null);
    if (error) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    } else {
      // Only log activity on successful update
      await (supabase as any).rpc('log_user_activity', { p_action: 'profile_completed', p_target_id: profileCase.id, p_target_table: 'student_cases' });
      toast({ title: isAr ? 'تم إكمال الملف' : 'File completed' });
      setProfileCase(null);
      setCaseFilter('profile_filled');
      if (user) await fetchCases(user.id);
    }
  };

  const cancelCompleteFile = () => {
    setCompleteFileConfirm(false);
    setPendingUpdateData(null);
    // Keep profile modal open so user can continue editing
  };

  const handleSubmitForApplication = (caseId: string) => {
    // Ask "Did you receive payment?" before submitting
    setPaymentConfirm(caseId);
  };

  const confirmPaymentAndSubmit = async (caseId: string) => {
    setSaving(true);
    const c = cases.find(cs => cs.id === caseId);
    if (!c) { setSaving(false); return; }

    // Determine next valid status
    let targetStatus = c.case_status;
    if (canTransition(c.case_status, CaseStatus.PAID)) {
      targetStatus = CaseStatus.PAID;
    } else if (['profile_filled', 'services_filled'].includes(c.case_status)) {
      // Fallback: force transition for team workflow (teams skip services_filled)
      targetStatus = CaseStatus.PAID;
    } else if (canTransition(c.case_status, CaseStatus.READY_TO_APPLY)) {
      targetStatus = CaseStatus.READY_TO_APPLY;
    }

    const updateData: Record<string, any> = { case_status: targetStatus };
    if (targetStatus === CaseStatus.PAID) {
      updateData.paid_at = new Date().toISOString();
    }

    // Auto-apply referral discount
    const lead = leads.find(l => l.id === c.lead_id);
    if (lead && (lead.source_type === 'friend' || lead.source_type === 'family')) {
      updateData.referral_discount = 500;
    }

    const { error } = await (supabase as any).from('student_cases').update(updateData).eq('id', caseId);
    await (supabase as any).rpc('log_user_activity', { p_action: 'submit_for_application', p_target_id: caseId, p_target_table: 'student_cases' });
    
    if (error) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    } else {
      toast({ title: t('lawyer.saved') });
    }
    setSaving(false);
    setPaymentConfirm(null);
    if (user) await fetchCases(user.id);
  };

  const handleDeleteCase = async (caseId: string) => {
    const { error } = await (supabase as any).from('student_cases').delete().eq('id', caseId);
    if (error) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    } else {
      toast({ title: isAr ? 'تم الحذف' : 'Case deleted' });
      if (user) await fetchCases(user.id);
    }
    setDeleteConfirm(null);
  };

  const handleDeleteAppointment = async (apptId: string) => {
    const { error } = await (supabase as any).from('appointments').delete().eq('id', apptId);
    if (!error) {
      toast({ title: isAr ? 'تم حذف الموعد' : 'Appointment deleted' });
      if (user) await fetchAppointments(user.id);
    } else {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    }
  };

  const handleRescheduleAppointment = async () => {
    if (!rescheduleAppt || !rescheduleDate || !rescheduleTime) return;
    setSaving(true);
    const newScheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
    const { error } = await (supabase as any).from('appointments').update({ scheduled_at: newScheduledAt }).eq('id', rescheduleAppt.id);
    if (!error) {
      toast({ title: isAr ? 'تم إعادة الجدولة' : 'Appointment rescheduled' });
      setRescheduleAppt(null);
      if (user) await fetchAppointments(user.id);
    } else {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    }
    setSaving(false);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/'); };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only show today's active scheduled appointments that haven't ended yet
  const todayAppointments = appointments.filter(a => {
    if (!isToday(new Date(a.scheduled_at))) return false;
    if (a.status !== 'scheduled') return false;
    const end = new Date(new Date(a.scheduled_at).getTime() + (a.duration_minutes || 30) * 60000);
    return end > new Date();
  });

  // ── Render two action buttons per tab/status ──
  const renderCaseActions = (c: any, lead: any) => {
    const status = c.case_status;
    const phoneBtn = lead.phone ? (
      <Button size="sm" variant="outline" className="h-8 text-xs active:scale-95 gap-1" asChild>
        <a href={`tel:${lead.phone}`}><Phone className="h-3.5 w-3.5" />{t('lawyer.quickCall')}</a>
      </Button>
    ) : null;

    // New tab: Call + Mark as Contacted
    if (['new', 'eligible', 'assigned'].includes(status)) {
      return (
        <div className="flex gap-2 flex-wrap">
          {phoneBtn}
          <Button size="sm" className="h-8 text-xs active:scale-95 gap-1" onClick={() => handleMarkContacted((lead as any).id, c.id)}>
            <CheckCircle className="h-3.5 w-3.5" />{t('lawyer.markContacted')}
          </Button>
          {/* Delete only on new tab */}
          {['new', 'eligible'].includes(status) && (
            <Button size="sm" variant="destructive" className="h-8 text-xs active:scale-95 gap-1" onClick={() => setDeleteConfirm(c.id)}>
              <Trash2 className="h-3.5 w-3.5" />{isAr ? 'حذف' : 'Delete'}
            </Button>
          )}
        </div>
      );
    }

    // Contacted: Call + Make Appointment
    if (status === 'contacted') {
      return (
        <div className="flex gap-2 flex-wrap">
          {phoneBtn}
          <Button size="sm" className="h-8 text-xs active:scale-95 gap-1" onClick={() => handleMakeAppointment(c.id)}>
            <CalendarDays className="h-3.5 w-3.5" />{isAr ? 'حجز موعد' : 'Make Appointment'}
          </Button>
        </div>
      );
    }

    // Appointment stage: Call + Complete Profile + Reschedule + Delete
    if (['appointment_scheduled', 'appointment_waiting', 'appointment_completed'].includes(status)) {
      const linkedAppt = appointments.find(a => a.case_id === c.id);
      return (
        <div className="flex gap-2 flex-wrap">
          {phoneBtn}
          <Button size="sm" className="h-8 text-xs active:scale-95 gap-1" onClick={() => openProfileModal(c)}>
            <FileText className="h-3.5 w-3.5" />{t('lawyer.completeProfile')}
          </Button>
          {linkedAppt && (
            <Button size="sm" variant="outline" className="h-8 text-xs active:scale-95 gap-1" onClick={() => {
              setRescheduleAppt(linkedAppt);
              const d = new Date(linkedAppt.scheduled_at);
              setRescheduleDate(format(d, 'yyyy-MM-dd'));
              setRescheduleTime(format(d, 'HH:mm'));
            }}>
              <CalendarDays className="h-3.5 w-3.5" />{isAr ? 'إعادة جدولة' : 'Reschedule'}
            </Button>
          )}
          <Button size="sm" variant="destructive" className="h-8 text-xs active:scale-95 gap-1" onClick={() => setDeleteConfirm(c.id)}>
            <Trash2 className="h-3.5 w-3.5" />{isAr ? 'حذف' : 'Delete'}
          </Button>
        </div>
      );
    }

    // File completed: Call + Submit for Application
    if (['profile_filled', 'services_filled'].includes(status)) {
      return (
        <div className="flex gap-2 flex-wrap">
          {phoneBtn}
          <Button size="sm" className="h-8 text-xs active:scale-95 gap-1" onClick={() => handleSubmitForApplication(c.id)}>
            <Send className="h-3.5 w-3.5" />{isAr ? 'إرسال للتقديم' : 'Submit for Application'}
          </Button>
        </div>
      );
    }

    // Submitted/paid: just call
    return phoneBtn ? <div className="flex gap-2">{phoneBtn}</div> : null;
  };

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#1E293B] text-white">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" alt="Darb" className="w-8 h-8 object-contain shrink-0" />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold leading-tight truncate">
                  <span className="hidden sm:inline">{t('lawyer.title')}</span>
                  <span className="sm:hidden">{isAr ? 'مرحبًا' : 'Hi'}, {profile?.full_name?.split(' ')[0]} 👋</span>
                </h1>
                <p className="hidden sm:block text-xs text-white/70 truncate">{profile?.full_name || user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <div className="[&_button]:text-white/70 [&_button]:hover:text-white [&_button]:hover:bg-white/10">
                <NotificationBell />
              </div>
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 active:scale-95" onClick={() => navigate('/')}>
                <ArrowLeftCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 active:scale-95" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop sidebar */}
      <div className="flex min-h-[calc(100vh-56px)]">
        <aside className="hidden lg:flex flex-col w-56 bg-[#1E293B] text-white shrink-0 border-e border-white/10">
          <nav className="flex-1 p-3 space-y-1">
            {TAB_CONFIG.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
                    isActive
                      ? 'bg-primary/20 text-white border-s-2 border-primary shadow-[0_0_12px_rgba(234,88,12,0.3)]'
                      : 'text-white/70 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{t(item.labelKey, item.id)}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-auto pb-20 lg:pb-0">
          <main className="px-3 sm:px-4 py-3 space-y-3">
            <PullToRefresh onRefresh={async () => { if (user) { await fetchCases(user.id); await fetchAppointments(user.id); } }} disabled={saving || savingProfile}>

            {/* ===== CASES TAB ===== */}
            {activeTab === 'cases' && (
              <>
                {/* Today's Appointments Summary */}
                {todayAppointments.length > 0 && (
                  <Card className="border-purple-200 bg-purple-50/50">
                    <CardContent className="p-3">
                      <h3 className="text-xs font-bold flex items-center gap-1.5 mb-2">
                        <CalendarDays className="h-3.5 w-3.5 text-purple-600" />
                        {isAr ? `مواعيد اليوم (${todayAppointments.length})` : `Today's Appointments (${todayAppointments.length})`}
                      </h3>
                      <div className="flex gap-2 overflow-x-auto">
                        {todayAppointments.map(appt => (
                          <div key={appt.id} className="shrink-0 flex items-center gap-2 px-2 py-1 bg-white rounded-lg border text-xs">
                            <span className="font-medium">{appt.student_name}</span>
                            <span className="text-muted-foreground">{format(new Date(appt.scheduled_at), 'HH:mm')}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Filter chips with neon coding */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {CASE_FILTER_TABS.map(f => {
                    const count = f === 'all' ? cases.length
                      : f === 'sla' ? cases.filter(c => isSlaBreached(c)).length
                      : cases.filter(c => matchesFilter(c.case_status, f)).length;
                    const active = caseFilter === f;
                    return (
                      <button
                        key={f}
                        onClick={() => setCaseFilter(f)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 border ${
                          active ? 'bg-primary text-primary-foreground border-primary' : `bg-muted text-muted-foreground hover:bg-muted/80 ${NEON_BORDERS[f] || 'border-transparent'}`
                        } ${f === 'sla' && count > 0 && !active ? 'border-destructive/50 text-destructive' : ''}`}
                      >
                        {isAr ? FILTER_LABELS[f].ar : FILTER_LABELS[f].en}
                        {count > 0 && <span className="ms-1">({count})</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Case Cards */}
                <div className="space-y-3">
                  <h2 className="font-bold text-sm flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />{t('lawyer.assignedCases')}
                    <Badge variant="secondary" className="text-xs">{filteredCases.length}</Badge>
                  </h2>

                  {filteredCases.map(c => {
                    const lead = getLeadInfo(c.lead_id);
                    const statusLabel = t(`lawyer.statuses.${c.case_status}`, c.case_status);
                    const statusColor = IMPORTED_STATUS_COLORS[c.case_status] || 'bg-gray-100 text-gray-800';
                    const neonBorder = getNeonBorder(c.case_status);
                    const sla = isSlaBreached(c);
                    const sourceType = (lead as any).source_type;
                    const isPaid = !!c.paid_at;

                    return (
                      <Card key={c.id} className={`transition-all duration-300 border-2 ${neonBorder} ${sla ? 'ring-1 ring-destructive/30' : ''}`}>
                        <CardContent className="p-3 space-y-2">
                          {/* Header row */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm truncate">{lead.full_name}</h3>
                                {sla && (
                                  <Badge variant="destructive" className="text-[10px] shrink-0">
                                    <AlertTriangle className="h-3 w-3 me-0.5" />{t('lawyer.slaBreached')}
                                  </Badge>
                                )}
                              </div>
                              {lead.phone && (
                                <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5" onClick={e => e.stopPropagation()}>
                                  <Phone className="h-3 w-3" />{lead.phone}
                                </a>
                              )}
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {sourceType && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {String(t(`lawyer.sources.${sourceType}`, sourceType))}
                                  </Badge>
                                )}
                                {(sourceType === 'friend' || sourceType === 'family') && (
                                  <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">
                                    {t('lawyer.referralDiscount', 'Referral Discount')}
                                  </Badge>
                                )}
                                {(lead as any).preferred_major && (
                                  <span className="text-[10px] text-muted-foreground">{(lead as any).preferred_major}</span>
                                )}
                              </div>
                            </div>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${statusColor}`}>{String(statusLabel)}</span>
                          </div>

                          {/* Financial info – only after payment */}
                          {isPaid && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2 bg-emerald-50 rounded"><span className="text-muted-foreground">{t('lawyer.serviceFee')}</span><p className="font-semibold">{c.service_fee} ₪</p></div>
                              <div className="p-2 bg-emerald-50 rounded"><span className="text-muted-foreground">{t('lawyer.yourCommission')}</span><p className="font-semibold">{c.lawyer_commission} ₪</p></div>
                            </div>
                          )}

                          {c.notes && <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">{c.notes}</p>}

                          {/* Two-button actions per tab */}
                          {renderCaseActions(c, lead)}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {filteredCases.length === 0 && <p className="text-center text-muted-foreground py-8">{t('lawyer.noCases')}</p>}
                </div>
              </>
            )}

            {/* ===== APPOINTMENTS TAB ===== */}
            {activeTab === 'appointments' && (
              <div className="space-y-4">
                {todayAppointments.length > 0 && (
                  <Card className="border-purple-200">
                    <CardContent className="p-3">
                      <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                        <CalendarDays className="h-4 w-4 text-purple-600" />
                        {t('lawyer.todaySchedule')}
                      </h3>
                      <div className="space-y-2">
                        {todayAppointments.map(appt => {
                          const linkedCase = cases.find(c => c.id === appt.case_id);
                          const linkedLead = linkedCase ? getLeadInfo(linkedCase.lead_id) : null;
                          return (
                            <div key={appt.id} className="flex items-center justify-between gap-2 p-2 bg-purple-50 rounded-lg">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-1 h-8 rounded-full bg-primary shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{appt.student_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(appt.scheduled_at), 'HH:mm')}
                                    {appt.location && ` · ${appt.location}`}
                                  </p>
                                </div>
                              </div>
                              {/* Quick actions: Call, Reschedule, Delete, Go to Case */}
                              <div className="flex gap-1 shrink-0 flex-wrap">
                                {linkedLead?.phone && (
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                                    <a href={`tel:${linkedLead.phone}`}><Phone className="h-3.5 w-3.5" /></a>
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => {
                                  setRescheduleAppt(appt);
                                  const d = new Date(appt.scheduled_at);
                                  setRescheduleDate(format(d, 'yyyy-MM-dd'));
                                  setRescheduleTime(format(d, 'HH:mm'));
                                }}>
                                  {isAr ? 'إعادة جدولة' : 'Reschedule'}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteAppointment(appt.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                {appt.case_id && (
                                  <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => { setCaseFilter('all'); setActiveTab('cases'); }}>
                                    {isAr ? 'عرض' : 'Case'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {user && <AppointmentCalendar userId={user.id} cases={cases} leads={leads} />}
              </div>
            )}

            {/* ===== ANALYTICS TAB ===== */}
            {activeTab === 'analytics' && (
              <div className="space-y-4">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />{t('lawyer.tabs.analytics', 'Analytics')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KPICard icon={<Users className="h-4 w-4 text-blue-600" />} label={t('lawyer.kpi.activeLeads')} value={String(kpis.activeLeads)} />
                  <KPICard icon={<CalendarDays className="h-4 w-4 text-purple-600" />} label={t('lawyer.kpi.todayAppts')} value={String(kpis.todayAppts)} />
                  <KPICard icon={<AlertTriangle className={`h-4 w-4 ${kpis.slaWarnings > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />} label={t('lawyer.kpi.slaWarnings')} value={String(kpis.slaWarnings)} highlight={kpis.slaWarnings > 0} />
                  <KPICard icon={<CreditCard className="h-4 w-4 text-emerald-600" />} label={t('lawyer.kpi.paidThisMonth')} value={String(kpis.paidThisMonth)} />
                  <KPICard icon={<DollarSign className="h-4 w-4 text-emerald-600" />} label={t('lawyer.kpi.myEarnings')} value={`${kpis.totalEarnings.toLocaleString()} ₪`} />
                  <KPICard icon={<TrendingUp className="h-4 w-4 text-blue-600" />} label={t('lawyer.kpi.totalRevenue')} value={`${kpis.totalServiceFees.toLocaleString()} ₪`} />
                  <KPICard icon={<CheckCircle className="h-4 w-4 text-green-600" />} label={t('lawyer.kpi.conversionRate', 'Conversion')} value={`${kpis.conversionRate}%`} />
                  <KPICard icon={<CalendarDays className="h-4 w-4 text-indigo-600" />} label={t('lawyer.kpi.showRate', 'Show Rate')} value={`${kpis.showRate}%`} />
                </div>

                <Card>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-xs mb-2">{t('lawyer.analytics.statusDistribution', 'Status Distribution')}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(
                        cases.reduce((acc: Record<string, number>, c) => {
                          acc[c.case_status] = (acc[c.case_status] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([status, count]) => (
                        <Badge key={status} variant="secondary" className="text-[10px] px-2 py-0.5">
                          {t(`lawyer.statuses.${status}`, status)}: {count as number}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {kpis.slaWarnings > 0 && (
                  <Card className="border-destructive/50">
                    <CardContent className="p-3">
                      <h3 className="font-semibold text-xs mb-2 flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" />{t('lawyer.analytics.slaAlerts', 'SLA Alerts')}
                      </h3>
                      <div className="space-y-1.5">
                        {cases.filter(c => isSlaBreached(c)).map(c => {
                          const lead = leads.find(l => l.id === c.lead_id);
                          const hours = differenceInHours(new Date(), new Date(c.created_at));
                          return (
                            <div key={c.id} className="flex items-center justify-between p-2 bg-red-50 rounded text-xs">
                              <span className="font-medium">{lead?.full_name || t('lawyer.unknown')}</span>
                              <Badge variant="destructive" className="text-[10px]">{hours}h</Badge>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ===== EARNINGS TAB ===== */}
            {activeTab === 'earnings' && user && (
              <div className="space-y-3">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />{t('lawyer.tabs.earnings', 'Earnings')}
                </h2>
                <EarningsPanel userId={user.id} role="lawyer" />
              </div>
            )}
            </PullToRefresh>
          </main>
        </div>
      </div>

      {/* Profile Completion Modal - expanded with visa fields and nested tabs */}
      <Dialog open={!!profileCase} onOpenChange={(open) => !open && setProfileCase(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby="profile-completion-desc">
          <DialogHeader>
            <DialogTitle>{t('lawyer.completeProfile')}</DialogTitle>
            <p id="profile-completion-desc" className="text-sm text-muted-foreground">{t('lawyer.completeProfileDesc', 'Fill in the student profile details below.')}</p>
          </DialogHeader>

          <Tabs defaultValue="personal" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="personal" className="flex-1 text-xs">{isAr ? 'بيانات شخصية' : 'Personal Info'}</TabsTrigger>
              <TabsTrigger value="visa" className="flex-1 text-xs">{isAr ? 'بيانات التأشيرة' : 'Visa Info'}</TabsTrigger>
              <TabsTrigger value="services" className="flex-1 text-xs">{isAr ? 'الخدمات' : 'Services'}</TabsTrigger>
              <TabsTrigger value="notes" className="flex-1 text-xs">{isAr ? 'ملاحظات' : 'Notes'}</TabsTrigger>
            </TabsList>

            <TabsContent value="personal">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div><Label>{t('admin.ready.fullName')}</Label><Input value={profileValues.student_full_name || ''} onChange={e => setProfileValues(v => ({ ...v, student_full_name: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.email')}</Label><Input type="email" value={profileValues.student_email || ''} onChange={e => setProfileValues(v => ({ ...v, student_email: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.phone')}</Label><Input value={profileValues.student_phone || ''} onChange={e => setProfileValues(v => ({ ...v, student_phone: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.age')}</Label><Input type="number" value={profileValues.student_age || ''} onChange={e => setProfileValues(v => ({ ...v, student_age: e.target.value }))} /></div>
                <div className="md:col-span-2"><Label>{t('admin.ready.address')}</Label><Input value={profileValues.student_address || ''} onChange={e => setProfileValues(v => ({ ...v, student_address: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.passportNumber')}</Label><Input value={profileValues.passport_number || ''} onChange={e => setProfileValues(v => ({ ...v, passport_number: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.nationality')}</Label><Input value={profileValues.nationality || ''} onChange={e => setProfileValues(v => ({ ...v, nationality: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.countryOfBirth')}</Label><Input value={profileValues.country_of_birth || ''} onChange={e => setProfileValues(v => ({ ...v, country_of_birth: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.languageProficiency')}</Label><Input value={profileValues.language_proficiency || ''} onChange={e => setProfileValues(v => ({ ...v, language_proficiency: e.target.value }))} placeholder="e.g. German B1" /></div>
              </div>
            </TabsContent>

            <TabsContent value="visa">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div><Label>{isAr ? 'الطول' : 'Height'}</Label><Input value={profileValues.height || ''} onChange={e => setProfileValues(v => ({ ...v, height: e.target.value }))} placeholder="e.g. 175 cm" /></div>
                <div><Label>{isAr ? 'لون العينين' : 'Eye Color'}</Label><Input value={profileValues.eye_color || ''} onChange={e => setProfileValues(v => ({ ...v, eye_color: e.target.value }))} /></div>
                <div>
                  <Label>{isAr ? 'الجنس' : 'Gender'}</Label>
                  <Select value={profileValues.gender || ''} onValueChange={v => setProfileValues(ev => ({ ...ev, gender: v }))}>
                    <SelectTrigger><SelectValue placeholder={isAr ? 'اختر' : 'Select'} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{isAr ? 'ذكر' : 'Male'}</SelectItem>
                      <SelectItem value="female">{isAr ? 'أنثى' : 'Female'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isAr ? 'جنسية مزدوجة' : 'Dual Citizenship'}</Label>
                  <Select value={profileValues.has_dual_citizenship || 'no'} onValueChange={v => setProfileValues(ev => ({ ...ev, has_dual_citizenship: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{isAr ? 'نعم' : 'Yes'}</SelectItem>
                      <SelectItem value="no">{isAr ? 'لا' : 'No'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isAr ? 'سجل جنائي' : 'Criminal Record'}</Label>
                  <Select value={profileValues.has_criminal_record || 'no'} onValueChange={v => setProfileValues(ev => ({ ...ev, has_criminal_record: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{isAr ? 'نعم' : 'Yes'}</SelectItem>
                      <SelectItem value="no">{isAr ? 'لا' : 'No'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="services">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div><Label>{t('admin.ready.destinationCity')}</Label><Input value={profileValues.selected_city || ''} onChange={e => setProfileValues(v => ({ ...v, selected_city: e.target.value }))} /></div>
                <div>
                  <Label>{t('admin.ready.schoolLabel')}</Label>
                  <Select value={profileValues.selected_school || ''} onValueChange={v => setProfileValues(ev => ({ ...ev, selected_school: v }))}>
                    <SelectTrigger><SelectValue placeholder={isAr ? 'اختر المدرسة' : 'Select school'} /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_SCHOOLS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('admin.ready.intensiveCourse')}</Label>
                  <Select value={profileValues.intensive_course || ''} onValueChange={v => setProfileValues(ev => ({ ...ev, intensive_course: v }))}>
                    <SelectTrigger><SelectValue placeholder={isAr ? 'اختر' : 'Select'} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{isAr ? 'نعم' : 'Yes'}</SelectItem>
                      <SelectItem value="no">{isAr ? 'لا' : 'No'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('admin.ready.accommodationType')}</Label>
                  <Select value={profileValues.accommodation_status || ''} onValueChange={v => setProfileValues(ev => ({ ...ev, accommodation_status: v }))}>
                    <SelectTrigger><SelectValue placeholder={t('admin.ready.selectAccommodation')} /></SelectTrigger>
                    <SelectContent>
                      {ACCOMMODATION_OPTIONS.map(o => (<SelectItem key={o} value={o}>{t(`admin.ready.accommodationTypes.${o}`)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes">
              <div className="mt-2">
                <Label>{isAr ? 'ملاحظات خاصة' : 'Special Notes'}</Label>
                <Textarea value={profileValues.notes || ''} onChange={e => setProfileValues(v => ({ ...v, notes: e.target.value }))} rows={5} />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setProfileCase(null)}>{t('common.cancel')}</Button>
            <Button onClick={saveProfileCompletion} disabled={savingProfile}>
              <Save className="h-4 w-4 me-1" />{savingProfile ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete File Confirmation Dialog */}
      <AlertDialog open={completeFileConfirm} onOpenChange={(open) => { if (!open) cancelCompleteFile(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'إكمال ملف الطالب' : 'Complete Student File'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr ? 'جميع الحقول مكتملة. هل تريد إكمال الملف ونقله إلى مرحلة "ملفات مكتملة"؟' : 'All fields are filled. Do you want to complete this file and move it to "Completed Files"?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelCompleteFile}>{isAr ? 'إغلاق' : 'Close'}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCompleteFile} disabled={savingProfile}>
              {savingProfile ? t('common.loading') : (isAr ? 'نعم، إكمال الملف' : 'Yes, Complete File')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Confirmation Dialog */}
      <AlertDialog open={!!paymentConfirm} onOpenChange={(open) => !open && setPaymentConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'تأكيد استلام الدفع' : 'Payment Confirmation'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr ? 'هل تم استلام الدفعة من الطالب؟ سيتم تحديث الحالة وحساب العمولات تلقائياً.' : 'Did you receive payment from the student? This will update the status and auto-calculate commissions.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (paymentConfirm) confirmPaymentAndSubmit(paymentConfirm); }} disabled={saving}>
              {saving ? t('common.loading') : (isAr ? 'نعم، تم الاستلام' : 'Yes, Payment Received')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'حذف الحالة' : 'Delete Case'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr ? 'هل أنت متأكد من حذف هذه الحالة؟ لا يمكن التراجع.' : 'Are you sure you want to delete this case? This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteConfirm) handleDeleteCase(deleteConfirm); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isAr ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleAppt} onOpenChange={(open) => !open && setRescheduleAppt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isAr ? 'إعادة جدولة الموعد' : 'Reschedule Appointment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{isAr ? 'التاريخ الجديد' : 'New Date'}</Label>
              <Input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{isAr ? 'الوقت الجديد' : 'New Time'}</Label>
              <Input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleAppt(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleRescheduleAppointment} disabled={saving || !rescheduleDate || !rescheduleTime}>
              {saving ? t('common.loading') : (isAr ? 'حفظ' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-2 py-2 lg:hidden"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-around max-w-md mx-auto">
            {TAB_CONFIG.map(item => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px] min-h-[44px] rounded-lg transition-all active:scale-95 ${
                    active ? 'text-orange-500' : 'text-gray-600'
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${active ? 'stroke-2' : 'stroke-[1.5]'}`} />
                  <span className={`text-[10px] font-medium ${active ? 'text-orange-500' : 'text-gray-600'}`}>{t(item.labelKey, item.id)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

function KPICard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-destructive/50' : ''}>
      <CardContent className="p-3 text-center">
        <div className="mx-auto mb-1 flex justify-center">{icon}</div>
        <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
        <p className={`text-lg font-bold mt-0.5 ${highlight ? 'text-destructive' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default TeamDashboardPage;
