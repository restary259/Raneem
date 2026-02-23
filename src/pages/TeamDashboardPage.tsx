
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useDirection } from '@/hooks/useDirection';
import { useTranslation } from 'react-i18next';
import { User } from '@supabase/supabase-js';
import { useDashboardData } from '@/hooks/useDashboardData';
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Phone, LogOut, ArrowLeftCircle, Briefcase,
  CheckCircle, AlertTriangle, CalendarDays, Users, CreditCard,
  Home, Calendar, DollarSign, TrendingUp, BarChart3, Send, FileText, Trash2, UserCheck
} from 'lucide-react';
import AppointmentCalendar from '@/components/lawyer/AppointmentCalendar';
import NotificationBell from '@/components/common/NotificationBell';
import { differenceInHours, isToday, format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import PullToRefresh from '@/components/common/PullToRefresh';
import { STATUS_COLORS as IMPORTED_STATUS_COLORS, CaseStatus } from '@/lib/caseStatus';
import { canTransition } from '@/lib/caseTransitions';

// Decomposed sub-components
import ProfileCompletionModal from '@/components/team/ProfileCompletionModal';
import ScheduleDialog from '@/components/team/ScheduleDialog';
import RescheduleDialog from '@/components/team/RescheduleDialog';
import ReassignDialog from '@/components/team/ReassignDialog';
import TeamAnalyticsTab from '@/components/team/TeamAnalyticsTab';
import { PaymentConfirmDialog, DeleteConfirmDialog } from '@/components/team/ConfirmationDialogs';
import {
  type TabId, type CaseFilterTab, CASE_FILTER_TABS, TAB_CONFIG,
  NEON_BORDERS, getNeonBorder, matchesFilter,
} from '@/components/team/TeamConstants';

const TeamDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const pendingRef = useRef(new Set<string>());
  const [deleteApptConfirm, setDeleteApptConfirm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('cases');
  const [caseFilter, setCaseFilter] = useState<CaseFilterTab>('all');

  // Dialog state — simplified, each sub-component manages its own form state
  const [profileCase, setProfileCase] = useState<any | null>(null);
  const [paymentConfirm, setPaymentConfirm] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [rescheduleAppt, setRescheduleAppt] = useState<any | null>(null);
  const [scheduleForCase, setScheduleForCase] = useState<any | null>(null);
  const [reassignCase, setReassignCase] = useState<any | null>(null);
  const [allLawyers, setAllLawyers] = useState<{ id: string; full_name: string }[]>([]);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { dir } = useDirection();
  const { t, i18n } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const isAr = i18n.language === 'ar';

  // Auth & role check
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate('/student-auth'); return; }
      const { data: roles } = await (supabase as any)
        .from('user_roles').select('role').eq('user_id', session.user.id).eq('role', 'lawyer');
      if (!roles?.length) {
        toast({ variant: 'destructive', title: t('lawyer.unauthorized'), description: t('lawyer.unauthorizedDesc') });
        navigate('/'); return;
      }
      setUser(session.user);
      setAuthReady(true);
    };
    init();
  }, [navigate, toast, t]);

  // Fetch all lawyers for reassignment dropdown
  useEffect(() => {
    if (!authReady) return;
    const fetchLawyers = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-team-members`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (resp.ok) {
          const result = await resp.json();
          setAllLawyers(result.members || []);
        } else {
          const { data } = await (supabase as any).from('profiles').select('id, full_name')
            .in('id', (await (supabase as any).from('user_roles').select('user_id').eq('role', 'lawyer')).data?.map((r: any) => r.user_id) ?? []);
          if (data) setAllLawyers(data);
        }
      } catch {
        const { data } = await (supabase as any).from('profiles').select('id, full_name')
          .in('id', (await (supabase as any).from('user_roles').select('user_id').eq('role', 'lawyer')).data?.map((r: any) => r.user_id) ?? []);
        if (data) setAllLawyers(data);
      }
    };
    fetchLawyers();
  }, [authReady]);

  // Centralised data layer
  const { data, isLoading, lastRefreshedAt, refetch } = useDashboardData({
    type: 'team', userId: user?.id, enabled: authReady,
    onError: (err) => toast({ variant: 'destructive', title: t('common.error'), description: err }),
  });

  // Defense-in-depth: client-side filter ensures team member only sees their own cases
  const cases: any[] = useMemo(() => (data?.cases ?? []).filter((c: any) => c.assigned_lawyer_id === user?.id), [data?.cases, user?.id]);
  const leads: any[] = data?.leads ?? [];
  const appointments: any[] = data?.appointments ?? [];
  const profile: any = data?.profile ?? null;

  useRealtimeSubscription('student_cases', refetch, authReady);
  useRealtimeSubscription('appointments', refetch, authReady);
  useRealtimeSubscription('leads', refetch, authReady);

  const getLeadInfo = useCallback((leadId: string) => leads.find(l => l.id === leadId) || { full_name: t('lawyer.unknown'), phone: '' }, [leads, t]);

  const isSlaBreached = useCallback((c: any) => {
    if (c.case_status !== 'assigned') return false;
    const lead = leads.find(l => l.id === c.lead_id);
    if (lead?.last_contacted) return false;
    return differenceInHours(new Date(), new Date(c.created_at)) > 24;
  }, [leads]);

  const kpis = useMemo(() => {
    const now = new Date();
    const activeLeads = cases.filter(c => c.case_status !== 'paid').length;
    const todayAppts = appointments.filter(a => {
      if (!isToday(new Date(a.scheduled_at))) return false;
      if (['cancelled', 'deleted', 'completed'].includes(a.status)) return false;
      return new Date(new Date(a.scheduled_at).getTime() + (a.duration_minutes || 30) * 60000) > now;
    }).length;
    const paidThisMonth = cases.filter(c => c.paid_at && new Date(c.paid_at).getMonth() === now.getMonth() && new Date(c.paid_at).getFullYear() === now.getFullYear()).length;
    const slaWarnings = cases.filter(c => isSlaBreached(c)).length;
    const totalEarnings = cases.filter(c => c.paid_at).reduce((s, c) => s + (Number(c.lawyer_commission) || 0), 0);
    const totalServiceFees = cases.filter(c => c.paid_at).reduce((s, c) => s + (Number(c.service_fee) || 0), 0);
    const conversionRate = cases.length > 0 ? Math.round((cases.filter(c => c.paid_at).length / cases.length) * 100) : 0;
    const pastAppts = appointments.filter(a => new Date(a.scheduled_at) < now);
    const bookedPast = pastAppts.filter(a => a.status === 'scheduled' || a.status === 'completed').length;
    const completedAppts = pastAppts.filter(a => a.status === 'completed').length;
    const showRate = bookedPast > 0 ? Math.round((completedAppts / bookedPast) * 100) : 0;
    return { activeLeads, todayAppts, paidThisMonth, slaWarnings, totalEarnings, totalServiceFees, conversionRate, showRate };
  }, [cases, appointments, isSlaBreached]);

  const filteredCases = useMemo(() => {
    if (caseFilter === 'sla') return cases.filter(c => isSlaBreached(c));
    return cases.filter(c => matchesFilter(c.case_status, caseFilter));
  }, [cases, caseFilter, isSlaBreached]);

  // ── ACTIONS ──
  // Issue 2: per-button loading + Issue 3: check both results
  const handleMarkContacted = async (leadId: string, caseId: string) => {
    if (pendingRef.current.has(caseId)) return;
    pendingRef.current.add(caseId);
    setActionLoadingId(caseId);
    try {
      const now = new Date().toISOString();
      const { error: leadErr } = await (supabase as any).from('leads').update({ last_contacted: now }).eq('id', leadId);
      if (leadErr) { toast({ variant: 'destructive', title: t('common.error'), description: leadErr.message }); return; }
      const caseItem = cases.find(c => c.id === caseId);
      if (caseItem && canTransition(caseItem.case_status, CaseStatus.CONTACTED)) {
        const { error: caseErr } = await (supabase as any).from('student_cases').update({ case_status: 'contacted' }).eq('id', caseId);
        if (caseErr) {
          toast({ variant: 'destructive', title: t('common.error'), description: t('lawyer.contactLoggedButNotTransitioned', 'Contact logged but status could not transition.') });
          try { await refetch(); } catch {}
          return;
        }
      }
      await (supabase as any).rpc('log_user_activity', { p_action: 'mark_contacted', p_target_id: caseId, p_target_table: 'student_cases' });
      const lead = leads.find(l => l.id === leadId);
      toast({ title: t('lawyer.contactLogged'), description: lead?.full_name || '' });
      try { await refetch(); } catch {}
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast({ variant: 'destructive', title: t('common.error'), description: err?.message || 'Unexpected error' });
    } finally { setActionLoadingId(null); pendingRef.current.delete(caseId); }
  };

  const confirmPaymentAndSubmit = async (caseId: string) => {
    setSaving(true);
    try {
      const c = cases.find(cs => cs.id === caseId);
      if (!c) return;
      const updateData: Record<string, any> = { submitted_to_admin_at: new Date().toISOString() };
      if (canTransition(c.case_status, CaseStatus.SERVICES_FILLED)) updateData.case_status = CaseStatus.SERVICES_FILLED;
      const lead = leads.find(l => l.id === c.lead_id);
      if (lead && (lead.source_type === 'friend' || lead.source_type === 'family')) updateData.referral_discount = 500;
      const { error } = await (supabase as any).from('student_cases').update(updateData).eq('id', caseId);
      if (error) toast({ variant: 'destructive', title: t('common.error'), description: error.message });
      else {
        await (supabase as any).rpc('log_user_activity', { p_action: 'submit_for_application', p_target_id: caseId, p_target_table: 'student_cases' });
        toast({ title: t('lawyer.saved') });
      }
      try { await refetch(); } catch {}
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast({ variant: 'destructive', title: t('common.error'), description: err?.message || 'Unexpected error' });
    } finally { setSaving(false); setPaymentConfirm(null); }
  };

  const handleDeleteCase = async (caseId: string) => {
    try {
      const { error } = await (supabase as any).from('student_cases').delete().eq('id', caseId);
      if (error) toast({ variant: 'destructive', title: t('common.error'), description: error.message });
      else { toast({ title: t('lawyer.caseDeleted') }); try { await refetch(); } catch {} }
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast({ variant: 'destructive', title: t('common.error'), description: err?.message || 'Unexpected error' });
    } finally { setDeleteConfirm(null); }
  };

  // Issue 9: Delete appointment with confirmation dialog
  const handleDeleteAppointment = async (apptId: string) => {
    if (pendingRef.current.has(apptId)) return;
    pendingRef.current.add(apptId);
    setActionLoadingId(apptId);
    try {
      const { error } = await (supabase as any).from('appointments').delete().eq('id', apptId);
      if (!error) { toast({ title: t('lawyer.appointmentDeleted') }); try { await refetch(); } catch {} }
      else toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast({ variant: 'destructive', title: t('common.error'), description: err?.message || 'Unexpected error' });
    } finally { setActionLoadingId(null); pendingRef.current.delete(apptId); setDeleteApptConfirm(null); }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/'); };

  const openProfileModal = (c: any) => {
    const lead = leads.find(l => l.id === c.lead_id);
    if (!lead) { toast({ variant: 'destructive', title: t('lawyer.leadNotFound') }); return; }
    setProfileCase(c);
  };

  if (!authReady || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 bg-[#1E293B] h-14" />
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[1,2,3,4,5].map(i => <div key={i} className="h-8 w-20 rounded-full bg-muted animate-pulse shrink-0" />)}
          </div>
          {[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  const todayAppointments = appointments.filter(a => {
    if (!isToday(new Date(a.scheduled_at))) return false;
    if (a.status !== 'scheduled') return false;
    return new Date(new Date(a.scheduled_at).getTime() + (a.duration_minutes || 30) * 60000) > new Date();
  });

  // ── Render case action buttons ──
  const renderCaseActions = (c: any, lead: any) => {
    const status = c.case_status;
    const phoneBtn = lead.phone ? (
      <Button size="sm" variant="outline" className="h-8 text-xs active:scale-95 gap-1" asChild>
        <a href={`tel:${lead.phone}`}><Phone className="h-3.5 w-3.5" />{t('lawyer.quickCall')}</a>
      </Button>
    ) : null;
    // Reassignment only allowed before submission to admin
    const REASSIGN_ALLOWED = ['assigned', 'contacted', 'appointment_scheduled', 'appointment_waiting', 'appointment_completed'];
    const canReassign = REASSIGN_ALLOWED.includes(status);
    const reassignBtn = canReassign ? (
      <Button size="sm" variant="ghost" className="h-8 text-xs active:scale-95 gap-1 text-muted-foreground" onClick={() => setReassignCase(c)}>
        <UserCheck className="h-3.5 w-3.5" />{t('lawyer.reassign')}
      </Button>
    ) : null;

    if (['new', 'eligible', 'assigned'].includes(status)) {
      const isThisLoading = actionLoadingId === c.id;
      return (
        <div className="flex gap-2 flex-wrap">
          {phoneBtn}
          <Button size="sm" className="h-8 text-xs active:scale-95 gap-1" onClick={() => handleMarkContacted(lead.id, c.id)} disabled={isThisLoading}>
            {isThisLoading ? <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}{t('lawyer.markContacted')}
          </Button>
          {reassignBtn}
          {['new', 'eligible'].includes(status) && (
            <Button size="sm" variant="destructive" className="h-8 text-xs active:scale-95 gap-1" onClick={() => setDeleteConfirm(c.id)} disabled={isThisLoading}>
              <Trash2 className="h-3.5 w-3.5" />{t('lawyer.deleteLabel')}
            </Button>
          )}
        </div>
      );
    }
    if (status === 'contacted') {
      return (<div className="flex gap-2 flex-wrap">{phoneBtn}
        <Button size="sm" className="h-8 text-xs active:scale-95 gap-1" onClick={() => { const cs = cases.find(x => x.id === c.id); setScheduleForCase(cs || null); }}>
          <CalendarDays className="h-3.5 w-3.5" />{t('lawyer.makeAppointment')}
        </Button>{reassignBtn}</div>);
    }
    if (['appointment_scheduled', 'appointment_waiting', 'appointment_completed'].includes(status)) {
      const linkedAppt = appointments.find(a => a.case_id === c.id);
      return (
        <div className="flex gap-2 flex-wrap">
          {phoneBtn}
          <Button size="sm" className="h-8 text-xs active:scale-95 gap-1" onClick={() => openProfileModal(c)}>
            <FileText className="h-3.5 w-3.5" />{t('lawyer.completeProfile')}
          </Button>
          {linkedAppt && (
             <Button size="sm" variant="outline" className="h-8 text-xs active:scale-95 gap-1" onClick={() => setRescheduleAppt(linkedAppt)}>
               <CalendarDays className="h-3.5 w-3.5" />{t('lawyer.reschedule')}
             </Button>
          )}
          {reassignBtn}
           <Button size="sm" variant="destructive" className="h-8 text-xs active:scale-95 gap-1" onClick={() => setDeleteConfirm(c.id)}>
             <Trash2 className="h-3.5 w-3.5" />{t('lawyer.deleteLabel')}
           </Button>
        </div>
      );
    }
    if (['profile_filled', 'services_filled'].includes(status)) {
      return (
        <div className="flex gap-2 flex-wrap">
          {phoneBtn}
          {status !== 'services_filled' && (
             <Button size="sm" className="h-8 text-xs active:scale-95 gap-1" onClick={() => setPaymentConfirm(c.id)}>
               <Send className="h-3.5 w-3.5" />{t('lawyer.submitForApplication')}
             </Button>
          )}
          {reassignBtn}
        </div>
      );
    }
    const actionBtns = [phoneBtn, reassignBtn].filter(Boolean);
    return actionBtns.length > 0 ? <div className="flex gap-2 flex-wrap">{actionBtns}</div> : null;
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
                <p className="hidden sm:block text-xs text-white/70 truncate">
                  {profile?.full_name || user?.email}
                  {lastRefreshedAt && (
                    <span className="ms-2 text-white/40">· {t('common.lastRefreshed', 'Updated')} {Math.round((Date.now() - lastRefreshedAt.getTime()) / 1000)}s</span>
                  )}
                </p>
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
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
                    isActive ? 'bg-primary/20 text-white border-s-2 border-primary shadow-[0_0_12px_rgba(234,88,12,0.3)]' : 'text-white/70 hover:bg-white/8 hover:text-white'
                  }`}>
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
            <PullToRefresh onRefresh={async () => { await refetch(); }} disabled={saving}>

            {/* CASES TAB */}
            {activeTab === 'cases' && (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {CASE_FILTER_TABS.map(f => {
                    const count = f === 'all' ? cases.length : f === 'sla' ? cases.filter(c => isSlaBreached(c)).length : cases.filter(c => matchesFilter(c.case_status, f)).length;
                    const active = caseFilter === f;
                    const countColor = !active && count > 0 ? (f === 'sla' ? 'text-destructive' : f === 'paid' ? 'text-emerald-600' : f === 'new' ? 'text-blue-600' : '') : '';
                    return (
                      <button key={f} onClick={() => setCaseFilter(f)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 border ${
                          active ? 'bg-primary text-primary-foreground border-primary' : `bg-muted text-muted-foreground hover:bg-muted/80 ${NEON_BORDERS[f] || 'border-transparent'}`
                        } ${f === 'sla' && count > 0 && !active ? 'border-destructive/50 text-destructive' : ''}`}>
                    {t(`lawyer.filters.${f === 'appointment_stage' ? 'appointment_scheduled' : f}`, f)}
                        {count > 0 && <span className={`ms-1 ${countColor}`}>({count})</span>}
                      </button>
                    );
                  })}
                </div>

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
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm truncate">{lead.full_name}</h3>
                                {sla && <Badge variant="destructive" className="text-[10px] shrink-0"><AlertTriangle className="h-3 w-3 me-0.5" />{t('lawyer.slaBreached')}</Badge>}
                              </div>
                              {lead.phone && (
                                <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5" onClick={e => e.stopPropagation()}>
                                  <Phone className="h-3 w-3" />{lead.phone}
                                </a>
                              )}
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {sourceType && <Badge variant="outline" className="text-[10px]">{String(t(`lawyer.sources.${sourceType}`, sourceType))}</Badge>}
                                {(sourceType === 'friend' || sourceType === 'family') && <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200">{t('lawyer.referralDiscount', 'Referral Discount')}</Badge>}
                                {(lead as any).preferred_major && <span className="text-[10px] text-muted-foreground">{(lead as any).preferred_major}</span>}
                              </div>
                            </div>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${statusColor}`}>{String(statusLabel)}</span>
                          </div>
                          {isPaid && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2 bg-emerald-50 rounded"><span className="text-muted-foreground">{t('lawyer.serviceFee')}</span><p className="font-semibold">{c.service_fee} ₪</p></div>
                              <div className="p-2 bg-emerald-50 rounded"><span className="text-muted-foreground">{t('lawyer.yourCommission')}</span><p className="font-semibold">{c.lawyer_commission} ₪</p></div>
                            </div>
                          )}
                          {c.notes && <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">{c.notes}</p>}
                          {c.admin_notes && (
                            <div className="flex items-start gap-1.5 p-2 rounded bg-amber-50 border border-amber-200">
                              <span className="text-[10px] font-bold text-amber-700 shrink-0">📋 {t('lawyer.adminNote')}</span>
                              <p className="text-[10px] text-amber-800">{c.admin_notes}</p>
                            </div>
                          )}
                          {c.reassigned_from && (
                            <div className="text-[10px] text-muted-foreground italic">
                              {t('lawyer.reassignedNote')}
                              {c.reassignment_notes && ` — ${c.reassignment_notes}`}
                            </div>
                          )}
                          {renderCaseActions(c, lead)}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {filteredCases.length === 0 && (
                    <Card><CardContent className="p-8 text-center">
                      <Briefcase className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">{t('lawyer.noCases')}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">{t('lawyer.noCasesHint', 'Cases assigned to you will appear here.')}</p>
                    </CardContent></Card>
                  )}
                </div>
              </>
            )}

            {/* TODAY TAB */}
            {activeTab === 'today' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-sm flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-purple-600" />
                    {t('lawyer.todayAppointments')}
                    <Badge variant="secondary" className="text-xs">{todayAppointments.length}</Badge>
                  </h2>
                  <span className="text-xs text-muted-foreground">{format(new Date(), 'EEEE, MMM d')}</span>
                </div>
                {todayAppointments.length === 0 ? (
                  <Card><CardContent className="p-8 text-center">
                    <CalendarDays className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">{t('lawyer.noTodayAppointments')}</p>
                  </CardContent></Card>
                ) : (
                  <div className="space-y-3">
                    {todayAppointments.map(appt => {
                      const linkedCase = cases.find(c => c.id === appt.case_id);
                      const linkedLead = linkedCase ? getLeadInfo(linkedCase.lead_id) : null;
                      const statusColor = linkedCase ? (IMPORTED_STATUS_COLORS[linkedCase.case_status] || 'bg-muted text-muted-foreground') : '';
                      const statusLabel = linkedCase ? t(`lawyer.statuses.${linkedCase.case_status}`, linkedCase.case_status) : '';
                      const isApptStage = linkedCase && ['appointment_scheduled', 'appointment_waiting', 'appointment_completed'].includes(linkedCase.case_status);
                      return (
                        <Card key={appt.id} className="border-purple-200/60">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="text-center shrink-0 bg-purple-50 rounded-lg px-2.5 py-1">
                                  <p className="text-lg font-bold leading-tight text-purple-700">{format(new Date(appt.scheduled_at), 'HH:mm')}</p>
                                  <p className="text-[10px] text-purple-500">{appt.duration_minutes || 30} min</p>
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm truncate">{appt.student_name}</p>
                                  {appt.location && <p className="text-xs text-muted-foreground truncate">📍 {appt.location}</p>}
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {linkedCase && <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor}`}>{String(statusLabel)}</span>}
                                    {linkedLead && (linkedLead as any).source_type && <Badge variant="outline" className="text-[10px]">{String(t(`lawyer.sources.${(linkedLead as any).source_type}`, (linkedLead as any).source_type))}</Badge>}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-wrap pt-1 border-t border-muted/50">
                              {linkedLead?.phone && <Button size="sm" variant="outline" className="h-8 text-xs gap-1" asChild><a href={`tel:${linkedLead.phone}`}><Phone className="h-3.5 w-3.5" />{t('lawyer.quickCall')}</a></Button>}
                              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setRescheduleAppt(appt)}>
                                <CalendarDays className="h-3.5 w-3.5" />{t('lawyer.reschedule')}
                              </Button>
                              {isApptStage && linkedCase && (
                                <Button size="sm" className="h-8 text-xs gap-1" onClick={() => openProfileModal(linkedCase)}>
                                  <FileText className="h-3.5 w-3.5" />{t('lawyer.completeProfile')}
                                </Button>
                              )}
                              {appt.case_id && <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => { setCaseFilter('all'); setActiveTab('cases'); }}>
                                 <Briefcase className="h-3.5 w-3.5" />{t('lawyer.viewCase')}
                               </Button>}
                              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteApptConfirm(appt.id)}>
                                <Trash2 className="h-3.5 w-3.5" />{t('lawyer.deleteLabel')}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* APPOINTMENTS TAB */}
            {activeTab === 'appointments' && (
              <div className="space-y-4">
                {user && <AppointmentCalendar userId={user.id} cases={cases} leads={leads} onAppointmentChange={refetch} />}
              </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && (
              <TeamAnalyticsTab kpis={kpis} cases={cases} leads={leads} isSlaBreached={isSlaBreached} />
            )}

            </PullToRefresh>
          </main>
        </div>
      </div>

      {/* Decomposed dialogs */}
      <ProfileCompletionModal profileCase={profileCase} leads={leads} userId={user?.id} onClose={() => setProfileCase(null)} onCompleted={(f) => setCaseFilter(f as CaseFilterTab)} refetch={refetch} />
      <ScheduleDialog scheduleForCase={scheduleForCase} leads={leads} userId={user?.id} onClose={() => setScheduleForCase(null)} refetch={refetch} />
      <RescheduleDialog appointment={rescheduleAppt} onClose={() => setRescheduleAppt(null)} refetch={refetch} />
      <ReassignDialog reassignCase={reassignCase} allLawyers={allLawyers} userId={user?.id} onClose={() => setReassignCase(null)} refetch={refetch} />
      <PaymentConfirmDialog caseId={paymentConfirm} saving={saving} onConfirm={confirmPaymentAndSubmit} onClose={() => setPaymentConfirm(null)} />
      <DeleteConfirmDialog caseId={deleteConfirm} onConfirm={handleDeleteCase} onClose={() => setDeleteConfirm(null)} />
      {/* Issue 9: Appointment delete confirmation */}
      <DeleteConfirmDialog caseId={deleteApptConfirm} onConfirm={handleDeleteAppointment} onClose={() => setDeleteApptConfirm(null)} />

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-2 py-2 lg:hidden"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center justify-around max-w-md mx-auto">
            {TAB_CONFIG.map(item => {
              const active = activeTab === item.id;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className={`relative flex flex-col items-center gap-0.5 min-w-[56px] min-h-[44px] justify-center rounded-lg px-2 py-1.5 transition-all active:scale-95 ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{t(item.labelKey, item.id)}</span>
                  {item.id === 'today' && kpis.todayAppts > 0 && (
                    <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamDashboardPage;
