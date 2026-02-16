
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Phone, ChevronDown, LogOut, ArrowLeftCircle, Save, Briefcase,
  CheckCircle, XCircle, AlertTriangle, CalendarDays, Users, CreditCard,
  Home, Calendar, FileText, DollarSign, TrendingUp, BarChart3
} from 'lucide-react';
import AppointmentCalendar from '@/components/lawyer/AppointmentCalendar';
import EarningsPanel from '@/components/influencer/EarningsPanel';
import NotificationBell from '@/components/common/NotificationBell';

import { differenceInHours, isToday, format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import PullToRefresh from '@/components/common/PullToRefresh';

import NextStepButton from '@/components/admin/NextStepButton';
import { STATUS_COLORS as IMPORTED_STATUS_COLORS, resolveStatus, CaseStatus } from '@/lib/caseStatus';
import { canTransition } from '@/lib/caseTransitions';

const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(IMPORTED_STATUS_COLORS).map(([k, v]) => [k, v + ' border-current/20'])
);

const ACCOMMODATION_OPTIONS = ['dorm', 'private_apartment', 'shared_flat', 'homestay', 'other'];

type TabId = 'cases' | 'appointments' | 'analytics' | 'earnings';

const TAB_CONFIG: { id: TabId; icon: React.ComponentType<{ className?: string }>; labelKey: string }[] = [
  { id: 'cases', icon: Home, labelKey: 'lawyer.tabs.cases' },
  { id: 'appointments', icon: Calendar, labelKey: 'lawyer.tabs.appointments' },
  { id: 'analytics', icon: BarChart3, labelKey: 'lawyer.tabs.analytics' },
  { id: 'earnings', icon: DollarSign, labelKey: 'lawyer.tabs.earnings' },
];

const CASE_FILTERS = ['all', 'assigned', 'contacted', 'appointment_scheduled', 'profile_filled', 'paid', 'sla'] as const;
type CaseFilter = typeof CASE_FILTERS[number];

const TeamDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCase, setEditingCase] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('cases');
  const [caseFilter, setCaseFilter] = useState<CaseFilter>('all');

  const [profileCase, setProfileCase] = useState<any | null>(null);
  const [profileValues, setProfileValues] = useState<Record<string, any>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [readyConfirm, setReadyConfirm] = useState<string | null>(null);

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

  // SLA check helper
  const isSlaBreached = (c: any) => {
    if (c.case_status !== 'assigned') return false;
    const lead = leads.find(l => l.id === c.lead_id);
    if (lead?.last_contacted) return false;
    return differenceInHours(new Date(), new Date(c.created_at)) > 24;
  };

  const kpis = useMemo(() => {
    const activeLeads = cases.filter(c => !['paid', 'settled', 'completed'].includes(c.case_status)).length;
    const todayAppts = appointments.filter(a => isToday(new Date(a.scheduled_at))).length;
    const paidThisMonth = cases.filter(c => {
      if (!c.paid_at) return false;
      const d = new Date(c.paid_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const slaWarnings = cases.filter(c => isSlaBreached(c)).length;
    const totalEarnings = cases.filter(c => c.paid_at).reduce((s, c) => s + (Number(c.lawyer_commission) || 0), 0);
    const totalServiceFees = cases.filter(c => c.paid_at).reduce((s, c) => s + (Number(c.service_fee) || 0), 0);
    const conversionRate = cases.length > 0 ? Math.round((cases.filter(c => c.paid_at).length / cases.length) * 100) : 0;
    const bookedAppts = appointments.filter(a => a.status === 'scheduled' || a.status === 'completed').length;
    const completedAppts = appointments.filter(a => a.status === 'completed').length;
    const showRate = bookedAppts > 0 ? Math.round((completedAppts / bookedAppts) * 100) : 0;
    return { activeLeads, todayAppts, paidThisMonth, slaWarnings, totalEarnings, totalServiceFees, conversionRate, showRate };
  }, [cases, leads, appointments]);

  // Filtered cases
  const filteredCases = useMemo(() => {
    if (caseFilter === 'all') return cases;
    if (caseFilter === 'sla') return cases.filter(c => isSlaBreached(c));
    return cases.filter(c => c.case_status === caseFilter);
  }, [cases, caseFilter, leads]);

  const startEdit = (c: any) => {
    setEditingCase(c.id);
    setEditValues({ case_status: c.case_status, notes: c.notes || '', selected_city: c.selected_city || '', selected_school: c.selected_school || '' });
  };

  const saveCase = async (caseId: string) => {
    const prevCase = cases.find(c => c.id === caseId);
    if (editValues.case_status === 'ready_to_apply' && prevCase?.case_status !== 'ready_to_apply') {
      setReadyConfirm(caseId);
      return;
    }
    await doSaveCase(caseId);
  };

  const doSaveCase = async (caseId: string) => {
    setSaving(true);
    const prevCase = cases.find(c => c.id === caseId);
    const updateData: any = {
      case_status: editValues.case_status,
      notes: editValues.notes || null,
      selected_city: editValues.selected_city || null,
      selected_school: editValues.selected_school || null,
    };
    if (editValues.case_status === 'paid' && prevCase?.case_status !== 'paid') {
      updateData.paid_at = new Date().toISOString();
    }
    const { error } = await (supabase as any).from('student_cases').update(updateData).eq('id', caseId);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); setSaving(false); return; }
    if (editValues.case_status === 'paid' && prevCase?.case_status !== 'paid') {
      toast({ title: t('lawyer.paidNotice') });
    }
    setSaving(false);
    setEditingCase(null);
    toast({ title: t('lawyer.saved') });
    if (user) await fetchCases(user.id);
  };

  const handleMarkContacted = async (leadId: string, caseId: string) => {
    const now = new Date().toISOString();
    await (supabase as any).from('leads').update({ last_contacted: now }).eq('id', leadId);
    const caseItem = cases.find(c => c.id === caseId);
    if (caseItem?.case_status === 'assigned') {
      await (supabase as any).from('student_cases').update({ case_status: 'contacted' }).eq('id', caseId);
    }
    toast({ title: t('lawyer.contactLogged') });
    if (user) await fetchCases(user.id);
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
    };

    const requiredProfileFields = ['student_full_name', 'student_email', 'student_phone', 'passport_number', 'nationality'];
    const allFilled = requiredProfileFields.every(f => profileValues[f]?.trim());
    if (allFilled && canTransition(profileCase.case_status, CaseStatus.PROFILE_FILLED)) {
      updateData.case_status = CaseStatus.PROFILE_FILLED;
    }

    const { error } = await (supabase as any).from('student_cases').update(updateData).eq('id', profileCase.id);
    setSavingProfile(false);
    if (error) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    } else {
      toast({ title: t('lawyer.saved') });
      setProfileCase(null);
      if (user) await fetchCases(user.id);
    }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/'); };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const todayAppointments = appointments.filter(a => isToday(new Date(a.scheduled_at)));

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Header — compact like influencer */}
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
                {/* Filter chips */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {CASE_FILTERS.map(f => {
                    const count = f === 'all' ? cases.length
                      : f === 'sla' ? cases.filter(c => isSlaBreached(c)).length
                      : cases.filter(c => c.case_status === f).length;
                    const active = caseFilter === f;
                    return (
                      <button
                        key={f}
                        onClick={() => setCaseFilter(f)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        } ${f === 'sla' && count > 0 && !active ? 'border border-destructive/50 text-destructive' : ''}`}
                      >
                        {String(t(`lawyer.filters.${f}`, f === 'sla' ? 'SLA' : String(t(`lawyer.statuses.${f}`, f))))}
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
                    const isEditing = editingCase === c.id;
                    const statusLabel = t(`lawyer.statuses.${c.case_status}`, c.case_status);
                    const statusColor = STATUS_COLORS[c.case_status] || 'bg-gray-100 text-gray-800';
                    const score = (lead as any).eligibility_score ?? null;
                    const lastContact = (lead as any).last_contacted;
                    const sla = isSlaBreached(c);
                    const sourceType = (lead as any).source_type;
                    const isPaid = c.case_status === 'paid' || c.case_status === 'completed';

                    return (
                      <Collapsible key={c.id}>
                        <Card className={`transition-all duration-300 ${sla ? 'border-destructive/50 ring-1 ring-destructive/20' : ''} ${isPaid ? 'border-emerald-300' : ''}`}>
                          <CollapsibleTrigger asChild>
                            <CardContent className="p-3 cursor-pointer hover:bg-muted/30 transition-colors active:scale-[0.98]">
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
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor}`}>{String(statusLabel)}</span>
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>

                              {/* Quick Actions */}
                              <div className="flex gap-2 mt-2 flex-wrap" onClick={e => e.stopPropagation()}>
                                {lead.phone && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs active:scale-95" asChild>
                                    <a href={`tel:${lead.phone}`}><Phone className="h-3 w-3 me-1" />{t('lawyer.quickCall')}</a>
                                  </Button>
                                )}
                                {c.case_status === 'assigned' && !lastContact && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs active:scale-95" onClick={() => handleMarkContacted((lead as any).id, c.id)}>
                                    <CheckCircle className="h-3 w-3 me-1" />{t('lawyer.markContacted')}
                                  </Button>
                                )}
                                {!isPaid && (
                                  <>
                                    <Button size="sm" variant="outline" className="h-7 text-xs active:scale-95" onClick={() => openProfileModal(c)}>
                                      <FileText className="h-3 w-3 me-1" />{t('lawyer.completeProfile')}
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 text-xs active:scale-95" onClick={() => startEdit(c)}>
                                      {t('common.edit')}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 border-t pt-3 space-y-3">
                              {/* Education info */}
                              {((lead as any).passport_type || (lead as any).english_units || (lead as any).math_units) && (
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  {(lead as any).passport_type && (
                                    <div className="p-2 bg-muted/30 rounded">
                                      <span className="text-muted-foreground">{t('admin.leads.passportType')}</span>
                                      <p className="font-medium">{t(`admin.leads.${(lead as any).passport_type === 'israeli_blue' ? 'israeliBlue' : (lead as any).passport_type === 'israeli_red' ? 'israeliRed' : 'otherPassport'}`)}</p>
                                    </div>
                                  )}
                                  {(lead as any).english_units && (
                                    <div className="p-2 bg-muted/30 rounded">
                                      <span className="text-muted-foreground">{t('admin.leads.englishCol')}</span>
                                      <p className="font-medium">{(lead as any).english_units} {t('lawyer.units', 'units')}</p>
                                    </div>
                                  )}
                                  {(lead as any).math_units && (
                                    <div className="p-2 bg-muted/30 rounded">
                                      <span className="text-muted-foreground">{t('admin.leads.mathCol')}</span>
                                      <p className="font-medium">{(lead as any).math_units} {t('lawyer.units', 'units')}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {score !== null && (
                                <div className={`flex items-start gap-2 p-2 rounded-lg text-xs ${score >= 50 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                                  {score >= 50 ? (
                                    <><CheckCircle className="h-4 w-4 shrink-0" /><span>{t('lawyer.eligible', { score })}</span></>
                                  ) : (
                                    <><XCircle className="h-4 w-4 shrink-0" /><span>{(lead as any).eligibility_reason || t('lawyer.ineligible', { score })}</span></>
                                  )}
                                </div>
                              )}

                              {!isEditing ? (
                                <>
                                  {c.notes && <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">{c.notes}</p>}
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="p-2 bg-muted/30 rounded"><span className="text-xs text-muted-foreground">{t('lawyer.serviceFee')}</span><p className="font-semibold">{c.service_fee} ₪</p></div>
                                    <div className="p-2 bg-muted/30 rounded"><span className="text-xs text-muted-foreground">{t('lawyer.yourCommission')}</span><p className="font-semibold">{c.lawyer_commission} ₪</p></div>
                                  </div>
                                </>
                              ) : (
                                <div className="space-y-3">
                                  <div>
                                    <Label className="text-xs">{t('lawyer.caseStatus')}</Label>
                                    <div className="mt-1">
                                      <NextStepButton caseId={c.id} currentStatus={c.case_status} onStatusUpdated={() => { if (user) fetchCases(user.id); }} />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div><Label className="text-xs">{t('lawyer.cityLabel')}</Label><Input value={editValues.selected_city} onChange={e => setEditValues(v => ({ ...v, selected_city: e.target.value }))} /></div>
                                    <div><Label className="text-xs">{t('lawyer.schoolLabel')}</Label><Input value={editValues.selected_school} onChange={e => setEditValues(v => ({ ...v, selected_school: e.target.value }))} /></div>
                                  </div>
                                  <div><Label className="text-xs">{t('lawyer.notesLabel')}</Label><Textarea value={editValues.notes} onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))} rows={2} /></div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => saveCase(c.id)} disabled={saving} className="active:scale-95"><Save className="h-3.5 w-3.5 me-1" />{saving ? t('common.loading') : t('common.save')}</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingCase(null)}>{t('common.cancel')}</Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  })}
                  {filteredCases.length === 0 && <p className="text-center text-muted-foreground py-8">{t('lawyer.noCases')}</p>}
                </div>
              </>
            )}

            {/* ===== APPOINTMENTS TAB ===== */}
            {activeTab === 'appointments' && (
              <div className="space-y-4">
                {/* Today's Appointments */}
                {todayAppointments.length > 0 && (
                  <Card className="border-purple-200">
                    <CardContent className="p-3">
                      <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                        <CalendarDays className="h-4 w-4 text-purple-600" />
                        {t('lawyer.todaySchedule')}
                      </h3>
                      <div className="space-y-2">
                        {todayAppointments.map(appt => (
                          <div key={appt.id} className="flex items-center gap-3 p-2 bg-purple-50 rounded-lg">
                            <div className="w-1 h-8 rounded-full bg-primary shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{appt.student_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(appt.scheduled_at), 'HH:mm')}
                                {appt.location && ` · ${appt.location}`}
                              </p>
                            </div>
                          </div>
                        ))}
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

                {/* KPI Cards */}
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

                {/* Status Distribution */}
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

                {/* SLA Alerts */}
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
                <EarningsPanel userId={user.id} />
              </div>
            )}
            </PullToRefresh>
          </main>
        </div>
      </div>

      {/* Profile Completion Modal */}
      <Dialog open={!!profileCase} onOpenChange={(open) => !open && setProfileCase(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby="profile-completion-desc">
          <DialogHeader>
            <DialogTitle>{t('lawyer.completeProfile')}</DialogTitle>
            <p id="profile-completion-desc" className="text-sm text-muted-foreground">{t('lawyer.completeProfileDesc', 'Fill in the student profile details below.')}</p>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div><Label>{t('admin.ready.fullName')}</Label><Input value={profileValues.student_full_name || ''} onChange={e => setProfileValues(v => ({ ...v, student_full_name: e.target.value }))} /></div>
            <div><Label>{t('admin.ready.email')}</Label><Input type="email" value={profileValues.student_email || ''} onChange={e => setProfileValues(v => ({ ...v, student_email: e.target.value }))} /></div>
            <div><Label>{t('admin.ready.phone')}</Label><Input value={profileValues.student_phone || ''} onChange={e => setProfileValues(v => ({ ...v, student_phone: e.target.value }))} /></div>
            <div><Label>{t('admin.ready.age')}</Label><Input type="number" value={profileValues.student_age || ''} onChange={e => setProfileValues(v => ({ ...v, student_age: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>{t('admin.ready.address')}</Label><Input value={profileValues.student_address || ''} onChange={e => setProfileValues(v => ({ ...v, student_address: e.target.value }))} /></div>
            <div><Label>{t('admin.ready.passportNumber')}</Label><Input value={profileValues.passport_number || ''} onChange={e => setProfileValues(v => ({ ...v, passport_number: e.target.value }))} /></div>
            <div><Label>{t('admin.ready.nationality')}</Label><Input value={profileValues.nationality || ''} onChange={e => setProfileValues(v => ({ ...v, nationality: e.target.value }))} /></div>
            <div><Label>{t('admin.ready.countryOfBirth')}</Label><Input value={profileValues.country_of_birth || ''} onChange={e => setProfileValues(v => ({ ...v, country_of_birth: e.target.value }))} /></div>
            <div><Label>{t('admin.ready.languageProficiency')}</Label><Input value={profileValues.language_proficiency || ''} onChange={e => setProfileValues(v => ({ ...v, language_proficiency: e.target.value }))} placeholder="e.g. German B1, English C1" /></div>
            <div><Label>{t('admin.ready.destinationCity')}</Label><Input value={profileValues.selected_city || ''} onChange={e => setProfileValues(v => ({ ...v, selected_city: e.target.value }))} /></div>
            <div><Label>{t('admin.ready.schoolLabel')}</Label><Input value={profileValues.selected_school || ''} onChange={e => setProfileValues(v => ({ ...v, selected_school: e.target.value }))} /></div>
            <div><Label>{t('admin.ready.intensiveCourse')}</Label><Input value={profileValues.intensive_course || ''} onChange={e => setProfileValues(v => ({ ...v, intensive_course: e.target.value }))} /></div>
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
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setProfileCase(null)}>{t('common.cancel')}</Button>
            <Button onClick={saveProfileCompletion} disabled={savingProfile}>
              <Save className="h-4 w-4 me-1" />{savingProfile ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ready to Apply Confirmation */}
      <AlertDialog open={!!readyConfirm} onOpenChange={(open) => !open && setReadyConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('lawyer.statuses.ready_to_apply')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('lawyer.readyConfirmDesc', 'Are you sure all information is correct and complete? The status will be changed to "Ready to Apply".')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (readyConfirm) { doSaveCase(readyConfirm); setReadyConfirm(null); } }}>
              {t('common.save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
