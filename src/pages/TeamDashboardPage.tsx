
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useDirection } from '@/hooks/useDirection';
import { useTranslation } from 'react-i18next';
import { User } from '@supabase/supabase-js';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Phone, ChevronDown, LogOut, ArrowLeftCircle, Save, Briefcase,
  CheckCircle, XCircle, AlertTriangle, CalendarDays, Users, CreditCard,
  Home, Calendar, FileText, Bot, GraduationCap, Eye, EyeOff, DollarSign, TrendingUp
} from 'lucide-react';
import AppointmentCalendar from '@/components/lawyer/AppointmentCalendar';
import NotificationBell from '@/components/common/NotificationBell';
import AIChatPopup from '@/components/chat/AIChatPopup';
import { differenceInHours, isToday } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { majorsData } from '@/data/majorsData';

// Simplified 6-stage funnel aligned with admin CasesManagement
const STATUS_KEYS = ['assigned', 'contacted', 'paid', 'ready_to_apply', 'visa_stage', 'completed'] as const;

const STATUS_COLORS: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-800 border-blue-300',
  contacted: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  paid: 'bg-green-100 text-green-800 border-green-300',
  ready_to_apply: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  visa_stage: 'bg-orange-100 text-orange-800 border-orange-300',
  completed: 'bg-teal-100 text-teal-800 border-teal-300',
  // Legacy fallbacks for display
  appointment: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  closed: 'bg-gray-100 text-gray-800 border-gray-300',
  registration_submitted: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  settled: 'bg-teal-100 text-teal-800 border-teal-300',
};

const NEON_BORDER: Record<string, string> = {
  assigned: 'shadow-[0_0_8px_rgba(59,130,246,0.3)]',
  contacted: 'shadow-[0_0_8px_rgba(234,179,8,0.3)]',
  paid: 'shadow-[0_0_8px_rgba(34,197,94,0.3)]',
  ready_to_apply: 'shadow-[0_0_8px_rgba(16,185,129,0.3)]',
  visa_stage: 'shadow-[0_0_8px_rgba(249,115,22,0.3)]',
  completed: 'shadow-[0_0_8px_rgba(20,184,166,0.3)]',
};

const ACCOMMODATION_OPTIONS = ['dorm', 'private_apartment', 'shared_flat', 'homestay', 'other'];

type SidebarTab = 'leads' | 'appointments' | 'majors' | 'ai';

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
  const [activeTab, setActiveTab] = useState<SidebarTab>('leads');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [profileCase, setProfileCase] = useState<any | null>(null);
  const [profileValues, setProfileValues] = useState<Record<string, any>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [majorSearch, setMajorSearch] = useState('');
  const [readyConfirm, setReadyConfirm] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { dir } = useDirection();
  const { t, i18n } = useTranslation('dashboard');
  const isMobile = useIsMobile();

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
        const { data: leadsData } = await (supabase as any).from('leads').select('id, full_name, phone, email, eligibility_score, eligibility_reason, source_type, passport_type, english_units, math_units, last_contacted, created_at').in('id', leadIds);
        if (leadsData) setLeads(leadsData);
      }
    }
  };

  const fetchAppointments = async (userId: string) => {
    const { data } = await (supabase as any).from('appointments').select('*').eq('lawyer_id', userId).order('scheduled_at', { ascending: true });
    if (data) setAppointments(data);
  };

  const getLeadInfo = (leadId: string) => leads.find(l => l.id === leadId) || { full_name: t('lawyer.unknown'), phone: '' };

  const kpis = useMemo(() => {
    const activeLeads = cases.filter(c => !['paid', 'settled', 'completed'].includes(c.case_status)).length;
    const todayAppts = appointments.filter(a => isToday(new Date(a.scheduled_at))).length;
    const paidThisMonth = cases.filter(c => {
      if (!c.paid_at) return false;
      const d = new Date(c.paid_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const slaWarnings = cases.filter(c => {
      if (c.case_status !== 'assigned') return false;
      const lead = leads.find(l => l.id === c.lead_id);
      if (lead?.last_contacted) return false;
      return differenceInHours(new Date(), new Date(c.created_at)) > 24;
    }).length;
    const totalEarnings = cases.filter(c => c.paid_at).reduce((s, c) => s + (Number(c.lawyer_commission) || 0), 0);
    const totalServiceFees = cases.filter(c => c.paid_at).reduce((s, c) => s + (Number(c.service_fee) || 0), 0);
    return { activeLeads, todayAppts, paidThisMonth, slaWarnings, totalEarnings, totalServiceFees };
  }, [cases, leads, appointments]);

  const todayAppointments = useMemo(() =>
    appointments.filter(a => isToday(new Date(a.scheduled_at))),
  [appointments]);

  const startEdit = (c: any) => {
    setEditingCase(c.id);
    setEditValues({ case_status: c.case_status, notes: c.notes || '', selected_city: c.selected_city || '', selected_school: c.selected_school || '' });
  };

  const saveCase = async (caseId: string) => {
    // Double confirmation for ready_to_apply
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
      toast({ title: t('common.error'), description: t('lawyer.paidNotice') });
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

  // Profile completion modal
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
    const { error } = await (supabase as any).from('student_cases').update({
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
    }).eq('id', profileCase.id);
    setSavingProfile(false);
    if (error) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    } else {
      toast({ title: t('lawyer.saved') });
      setProfileCase(null);
      if (user) await fetchCases(user.id);
    }
  };

  // Filtered majors for quick access (must be before any early returns to follow React hooks rules)
  const filteredMajors = useMemo(() => {
    if (!majorSearch.trim()) return majorsData;
    const q = majorSearch.toLowerCase();
    return majorsData.map(cat => ({
      ...cat,
      subMajors: cat.subMajors.filter(s =>
        s.nameEN.toLowerCase().includes(q) || s.nameAR.includes(q)
      ),
    })).filter(cat => cat.subMajors.length > 0);
  }, [majorSearch]);

  const sidebarItems = [
    { id: 'leads' as SidebarTab, label: t('lawyer.assignedCases'), icon: Home },
    { id: 'appointments' as SidebarTab, label: t('admin.appointments.title'), icon: Calendar },
    { id: 'majors' as SidebarTab, label: t('lawyer.majorsTab', 'Majors'), icon: GraduationCap },
    { id: 'ai' as SidebarTab, label: 'AI Agent', icon: Bot },
  ];

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/'); };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderLeadCards = () => (
    <div className="space-y-4">
      <h2 className="font-bold text-base flex items-center gap-2">
        <Briefcase className="h-4 w-4" />{t('lawyer.assignedCases')}
        <Badge variant="secondary" className="text-xs">{cases.length}</Badge>
      </h2>

      {cases.map(c => {
        const lead = getLeadInfo(c.lead_id);
        const isEditing = editingCase === c.id;
        const statusLabel = t(`lawyer.statuses.${c.case_status}`, c.case_status);
        const statusColor = STATUS_COLORS[c.case_status] || 'bg-gray-100 text-gray-800';
        const neonGlow = NEON_BORDER[c.case_status] || '';
        const score = (lead as any).eligibility_score ?? null;
        const isEligible = score !== null && score >= 50;
        const lastContact = (lead as any).last_contacted;
        const hoursSinceCreated = differenceInHours(new Date(), new Date(c.created_at));
        const isSlaBreached = c.case_status === 'assigned' && !lastContact && hoursSinceCreated > 24;

        return (
          <Collapsible key={c.id}>
            <Card className={`transition-all duration-300 ${neonGlow} ${isSlaBreached ? 'border-destructive/50 ring-1 ring-destructive/20' : ''}`}>
              <CollapsibleTrigger asChild>
                <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors active:scale-[0.98]">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm truncate">{lead.full_name}</h3>
                        {isSlaBreached && (
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
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {c.selected_city && <span className="text-xs text-muted-foreground">{c.selected_city} {c.selected_school ? `• ${c.selected_school}` : ''}</span>}
                        {(lead as any).source_type && <Badge variant="outline" className="text-[10px]">{String(t(`lawyer.sources.${(lead as any).source_type}`, { defaultValue: (lead as any).source_type }))}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>{String(statusLabel)}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 mt-3 flex-wrap" onClick={e => e.stopPropagation()}>
                    {lead.phone && (
                      <Button size="sm" variant="outline" className="h-7 text-xs hover:shadow-[0_0_12px_rgba(59,130,246,0.4)] active:scale-95" asChild>
                        <a href={`tel:${lead.phone}`}><Phone className="h-3 w-3 me-1" />{t('lawyer.quickCall')}</a>
                      </Button>
                    )}
                    {c.case_status === 'assigned' && !lastContact && (
                      <Button size="sm" variant="outline" className="h-7 text-xs hover:shadow-[0_0_12px_rgba(34,197,94,0.4)] active:scale-95" onClick={() => handleMarkContacted((lead as any).id, c.id)}>
                        <CheckCircle className="h-3 w-3 me-1" />{t('lawyer.markContacted')}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs active:scale-95" onClick={() => openProfileModal(c)}>
                      <FileText className="h-3 w-3 me-1" />{t('lawyer.completeProfile', 'Complete Profile')}
                    </Button>
                    {!['paid', 'settled', 'completed'].includes(c.case_status) && (
                      <Button size="sm" variant="outline" className="h-7 text-xs active:scale-95" onClick={() => startEdit(c)}>
                        {t('common.edit')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 border-t pt-3 space-y-3">
                  {score !== null && (
                    <div className={`flex items-start gap-2 p-2 rounded-lg text-xs ${isEligible ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                      {isEligible ? (
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
                        <div className="p-2 bg-muted/30 rounded"><span className="text-xs text-muted-foreground">{t('lawyer.serviceFee')}</span><p className="font-semibold">{c.service_fee} €</p></div>
                        <div className="p-2 bg-muted/30 rounded"><span className="text-xs text-muted-foreground">{t('lawyer.yourCommission')}</span><p className="font-semibold">{c.lawyer_commission} €</p></div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div><Label className="text-xs">{t('lawyer.caseStatus')}</Label>
                        <Select value={editValues.case_status} onValueChange={v => setEditValues(ev => ({ ...ev, case_status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUS_KEYS.map(s => <SelectItem key={s} value={s}>{t(`lawyer.statuses.${s}`)}</SelectItem>)}</SelectContent>
                        </Select>
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
      {cases.length === 0 && <p className="text-center text-muted-foreground py-8">{t('lawyer.noCases')}</p>}
    </div>
  );

  const renderCalendarSidebar = () => (
    <div className="space-y-4">
      {/* Today's appointments always visible */}
      {todayAppointments.length > 0 && (
        <Card className="border-purple-200">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-purple-600" />
              {t('lawyer.todaySchedule')}
            </h3>
            <div className="space-y-2">
              {todayAppointments.map(appt => (
                <div key={appt.id} className="p-2 bg-purple-50 rounded-lg text-sm">
                  <p className="font-semibold text-xs">{appt.student_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(appt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {appt.location && ` • ${appt.location}`}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar toggle button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 active:scale-95"
        onClick={() => setShowCalendar(!showCalendar)}
      >
        {showCalendar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        {showCalendar ? t('lawyer.hideCalendar', 'Hide Calendar') : t('lawyer.showCalendar', 'Show Calendar')}
      </Button>

      {/* Calendar - hidden by default */}
      {showCalendar && user && <AppointmentCalendar userId={user.id} cases={cases} leads={leads} />}
    </div>
  );

  const renderMajorsTab = () => (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h2 className="font-bold text-base flex items-center gap-2">
        <GraduationCap className="h-4 w-4" />
        {t('lawyer.majorsTab', 'Majors Quick Reference')}
      </h2>
      <Input
        placeholder={t('lawyer.searchMajors', 'Search majors…')}
        value={majorSearch}
        onChange={e => setMajorSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="space-y-3">
        {filteredMajors.map(cat => (
          <Collapsible key={cat.id}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardContent className="p-3 cursor-pointer hover:bg-muted/30 transition-colors flex items-center justify-between active:scale-[0.98]">
                  <span className="font-semibold text-sm">{i18n.language === 'ar' ? cat.title : cat.titleEN}</span>
                  <Badge variant="secondary" className="text-[10px]">{cat.subMajors.length}</Badge>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2">
                  {cat.subMajors.map(sub => (
                    <div key={sub.id} className="p-2 bg-muted/20 rounded-lg">
                      <p className="font-medium text-sm">{i18n.language === 'ar' ? sub.nameAR : sub.nameEN}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{i18n.language === 'ar' ? sub.description : sub.descriptionEN}</p>
                      {sub.durationEN && <p className="text-xs text-muted-foreground mt-0.5">⏱ {i18n.language === 'ar' ? sub.duration : sub.durationEN}</p>}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
        {filteredMajors.length === 0 && <p className="text-center text-muted-foreground py-8">{t('common.noResults', 'No results')}</p>}
      </div>
    </div>
  );

  // Mobile bottom nav
  const mobileBottomNav = (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1E293B] border-t border-white/10 flex items-center justify-around py-2 lg:hidden">
      {sidebarItems.map(item => (
        <button
          key={item.id}
          onClick={() => {
            if (item.id === 'ai') { setShowAI(true); }
            else { setActiveTab(item.id); }
          }}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px] min-h-[44px] rounded-lg transition-all ${
            activeTab === item.id ? 'text-primary' : 'text-white/60'
          }`}
        >
          <item.icon className="h-5 w-5" />
          <span className="text-[10px]">{item.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#1E293B] text-white">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" alt="Darb" className="w-9 h-9 object-contain" />
              <div>
                <h1 className="text-lg font-bold">{t('lawyer.title')}</h1>
                <p className="text-xs text-white/70">{profile?.full_name || user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
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

      <div className="flex min-h-[calc(100vh-56px)]">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-56 bg-[#1E293B] text-white shrink-0 border-e border-white/10">
          <nav className="flex-1 p-3 space-y-1">
            {sidebarItems.map(item => {
              const isActive = activeTab === item.id && item.id !== 'ai';
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'ai') { setShowAI(!showAI); }
                    else { setActiveTab(item.id); }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
                    isActive
                      ? 'bg-primary/20 text-white border-s-2 border-primary shadow-[0_0_12px_rgba(234,88,12,0.3)]'
                      : item.id === 'ai' && showAI
                        ? 'bg-blue-500/20 text-white'
                        : 'text-white/70 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-auto pb-20 lg:pb-0">
          {/* KPI Strip */}
          <div className="px-4 py-4">
            <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 ${isMobile ? 'overflow-x-auto' : ''}`}>
              <Card><CardContent className="p-3 text-center">
                <Users className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                <p className="text-xs text-muted-foreground">{t('lawyer.kpi.activeLeads')}</p>
                <p className="text-xl font-bold">{kpis.activeLeads}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <CalendarDays className="h-4 w-4 mx-auto mb-1 text-purple-600" />
                <p className="text-xs text-muted-foreground">{t('lawyer.kpi.todayAppts')}</p>
                <p className="text-xl font-bold">{kpis.todayAppts}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <CreditCard className="h-4 w-4 mx-auto mb-1 text-emerald-600" />
                <p className="text-xs text-muted-foreground">{t('lawyer.kpi.paidThisMonth')}</p>
                <p className="text-xl font-bold text-emerald-600">{kpis.paidThisMonth}</p>
              </CardContent></Card>
              <Card className={kpis.slaWarnings > 0 ? 'border-destructive/50' : ''}>
                <CardContent className="p-3 text-center">
                  <AlertTriangle className={`h-4 w-4 mx-auto mb-1 ${kpis.slaWarnings > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <p className="text-xs text-muted-foreground">{t('lawyer.kpi.slaWarnings')}</p>
                  <p className={`text-xl font-bold ${kpis.slaWarnings > 0 ? 'text-destructive' : ''}`}>{kpis.slaWarnings}</p>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-3 text-center">
                  <DollarSign className="h-4 w-4 mx-auto mb-1 text-emerald-600" />
                  <p className="text-xs text-muted-foreground">{t('lawyer.kpi.myEarnings', 'My Earnings')}</p>
                  <p className="text-xl font-bold text-emerald-700">{kpis.totalEarnings.toLocaleString()} ₪</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-3 text-center">
                  <TrendingUp className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                  <p className="text-xs text-muted-foreground">{t('lawyer.kpi.totalRevenue', 'Total Revenue')}</p>
                  <p className="text-xl font-bold text-blue-700">{kpis.totalServiceFees.toLocaleString()} ₪</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Body */}
          <main className="px-4 pb-8">
            {activeTab === 'leads' && (
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 lg:w-[70%]">
                  {renderLeadCards()}
                </div>
                <div className="lg:w-[30%]">
                  {renderCalendarSidebar()}
                </div>
              </div>
            )}
            {activeTab === 'appointments' && (
              <div className="max-w-2xl mx-auto">
                {user && <AppointmentCalendar userId={user.id} cases={cases} leads={leads} />}
              </div>
            )}
            {activeTab === 'majors' && renderMajorsTab()}
          </main>
        </div>
      </div>

      {/* AI Agent Sidebar Popup */}
      {showAI && (
        <div className="fixed inset-y-0 end-0 z-50 w-full sm:w-[380px] shadow-2xl animate-in slide-in-from-right duration-200">
          <div className="h-full">
            <AIChatPopup onClose={() => setShowAI(false)} />
          </div>
        </div>
      )}

      {/* Backdrop for AI popup */}
      {showAI && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowAI(false)} />
      )}

      {/* Profile Completion Modal */}
      <Dialog open={!!profileCase} onOpenChange={(open) => !open && setProfileCase(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('lawyer.completeProfile', 'Complete Student Profile')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <Label>{t('admin.ready.fullName')}</Label>
              <Input value={profileValues.student_full_name || ''} onChange={e => setProfileValues(v => ({ ...v, student_full_name: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.email')}</Label>
              <Input type="email" value={profileValues.student_email || ''} onChange={e => setProfileValues(v => ({ ...v, student_email: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.phone')}</Label>
              <Input value={profileValues.student_phone || ''} onChange={e => setProfileValues(v => ({ ...v, student_phone: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.age')}</Label>
              <Input type="number" value={profileValues.student_age || ''} onChange={e => setProfileValues(v => ({ ...v, student_age: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>{t('admin.ready.address')}</Label>
              <Input value={profileValues.student_address || ''} onChange={e => setProfileValues(v => ({ ...v, student_address: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.passportNumber')}</Label>
              <Input value={profileValues.passport_number || ''} onChange={e => setProfileValues(v => ({ ...v, passport_number: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.nationality')}</Label>
              <Input value={profileValues.nationality || ''} onChange={e => setProfileValues(v => ({ ...v, nationality: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.countryOfBirth')}</Label>
              <Input value={profileValues.country_of_birth || ''} onChange={e => setProfileValues(v => ({ ...v, country_of_birth: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.languageProficiency')}</Label>
              <Input value={profileValues.language_proficiency || ''} onChange={e => setProfileValues(v => ({ ...v, language_proficiency: e.target.value }))} placeholder="e.g. German B1, English C1" />
            </div>
            <div>
              <Label>{t('admin.ready.destinationCity')}</Label>
              <Input value={profileValues.selected_city || ''} onChange={e => setProfileValues(v => ({ ...v, selected_city: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.schoolLabel')}</Label>
              <Input value={profileValues.selected_school || ''} onChange={e => setProfileValues(v => ({ ...v, selected_school: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.intensiveCourse')}</Label>
              <Input value={profileValues.intensive_course || ''} onChange={e => setProfileValues(v => ({ ...v, intensive_course: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.accommodationType')}</Label>
              <Select value={profileValues.accommodation_status || ''} onValueChange={v => setProfileValues(ev => ({ ...ev, accommodation_status: v }))}>
                <SelectTrigger><SelectValue placeholder={t('admin.ready.selectAccommodation')} /></SelectTrigger>
                <SelectContent>
                  {ACCOMMODATION_OPTIONS.map(o => (
                    <SelectItem key={o} value={o}>{t(`admin.ready.accommodationTypes.${o}`)}</SelectItem>
                  ))}
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

      {/* Ready to Apply Confirmation Dialog */}
      <AlertDialog open={!!readyConfirm} onOpenChange={(open) => !open && setReadyConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('lawyer.statuses.ready_to_apply')}</AlertDialogTitle>
            <AlertDialogDescription>
              {i18n.language === 'ar' 
                ? 'هل أنت متأكد أن جميع المعلومات صحيحة وكاملة؟ سيتم تغيير الحالة إلى "جاهز للتقديم".'
                : 'Are you sure all information is correct and complete? The status will be changed to "Ready to Apply".'}
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
      {isMobile && mobileBottomNav}
    </div>
  );
};

export default TeamDashboardPage;
