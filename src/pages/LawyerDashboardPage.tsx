
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
import {
  Phone, ChevronDown, LogOut, ArrowLeftCircle, Save, Briefcase,
  CheckCircle, XCircle, AlertTriangle, CalendarDays, Users, CreditCard
} from 'lucide-react';
import AppointmentCalendar from '@/components/lawyer/AppointmentCalendar';
import { differenceInHours, isToday } from 'date-fns';

const STATUS_KEYS = ['assigned', 'contacted', 'appointment', 'closed', 'paid', 'ready_to_apply', 'registration_submitted', 'visa_stage', 'settled'] as const;

const STATUS_COLORS: Record<string, string> = {
  assigned: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  appointment: 'bg-purple-100 text-purple-800',
  closed: 'bg-gray-100 text-gray-800',
  lost: 'bg-red-100 text-red-800',
  paid: 'bg-green-100 text-green-800',
  ready_to_apply: 'bg-emerald-100 text-emerald-800',
  registration_submitted: 'bg-indigo-100 text-indigo-800',
  visa_stage: 'bg-orange-100 text-orange-800',
  settled: 'bg-teal-100 text-teal-800',
};

const LawyerDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCase, setEditingCase] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { dir } = useDirection();
  const { t } = useTranslation('dashboard');

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
        const { data: leadsData } = await (supabase as any).from('leads').select('id, full_name, phone, eligibility_score, eligibility_reason, source_type, passport_type, english_units, math_units, last_contacted, created_at').in('id', leadIds);
        if (leadsData) setLeads(leadsData);
      }
    }
  };

  const fetchAppointments = async (userId: string) => {
    const { data } = await (supabase as any).from('appointments').select('*').eq('lawyer_id', userId).order('scheduled_at', { ascending: true });
    if (data) setAppointments(data);
  };

  const getLeadInfo = (leadId: string) => leads.find(l => l.id === leadId) || { full_name: t('lawyer.unknown'), phone: '' };

  // KPI computations
  const kpis = useMemo(() => {
    const activeLeads = cases.filter(c => !['paid', 'settled', 'completed'].includes(c.case_status)).length;
    const todayAppts = appointments.filter(a => isToday(new Date(a.scheduled_at))).length;
    const paidThisMonth = cases.filter(c => {
      if (!c.paid_at) return false;
      const d = new Date(c.paid_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    // SLA: leads not contacted within 24h of case creation
    const slaWarnings = cases.filter(c => {
      if (c.case_status !== 'assigned') return false;
      const lead = leads.find(l => l.id === c.lead_id);
      const lastContact = lead?.last_contacted;
      if (lastContact) return false; // already contacted
      const hoursSinceCreated = differenceInHours(new Date(), new Date(c.created_at));
      return hoursSinceCreated > 24;
    }).length;

    return { activeLeads, todayAppts, paidThisMonth, slaWarnings };
  }, [cases, leads, appointments]);

  const todayAppointments = useMemo(() =>
    appointments.filter(a => isToday(new Date(a.scheduled_at))),
  [appointments]);

  const startEdit = (c: any) => {
    setEditingCase(c.id);
    setEditValues({ case_status: c.case_status, notes: c.notes || '', selected_city: c.selected_city || '', selected_school: c.selected_school || '' });
  };

  const saveCase = async (caseId: string) => {
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

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/'); };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Header */}
      <header className="bg-[#1E293B] text-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" alt="Darb" className="w-9 h-9 object-contain" />
              <div>
                <h1 className="text-lg font-bold">{t('lawyer.title')}</h1>
                <p className="text-xs text-white/70">{profile?.full_name || user?.email}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate('/')}>
                <ArrowLeftCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* KPI Strip */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        </div>
      </div>

      {/* Main Content: 70/30 split on desktop */}
      <main className="max-w-7xl mx-auto px-4 pb-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column - 70% - Lead Cards */}
          <div className="flex-1 lg:w-[70%] space-y-4">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />{t('lawyer.assignedCases')}
              <Badge variant="secondary" className="text-xs">{cases.length}</Badge>
            </h2>

            {cases.map(c => {
              const lead = getLeadInfo(c.lead_id);
              const isEditing = editingCase === c.id;
              const statusLabel = t(`lawyer.statuses.${c.case_status}`, c.case_status);
              const statusColor = STATUS_COLORS[c.case_status] || 'bg-gray-100 text-gray-800';
              const score = (lead as any).eligibility_score ?? null;
              const isEligible = score !== null && score >= 50;

              // SLA check for this specific lead
              const lastContact = (lead as any).last_contacted;
              const hoursSinceCreated = differenceInHours(new Date(), new Date(c.created_at));
              const isSlaBreached = c.case_status === 'assigned' && !lastContact && hoursSinceCreated > 24;

              return (
                <Collapsible key={c.id}>
                  <Card className={`shadow-sm ${isSlaBreached ? 'border-destructive/50 ring-1 ring-destructive/20' : ''}`}>
                    <CollapsibleTrigger asChild>
                      <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
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

                        {/* Quick Actions Row */}
                        <div className="flex gap-2 mt-3 flex-wrap" onClick={e => e.stopPropagation()}>
                          {lead.phone && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                              <a href={`tel:${lead.phone}`}><Phone className="h-3 w-3 me-1" />{t('lawyer.quickCall')}</a>
                            </Button>
                          )}
                          {c.case_status === 'assigned' && !lastContact && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleMarkContacted((lead as any).id, c.id)}>
                              <CheckCircle className="h-3 w-3 me-1" />{t('lawyer.markContacted')}
                            </Button>
                          )}
                          {!['paid', 'settled', 'completed'].includes(c.case_status) && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => startEdit(c)}>
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
                              <Button size="sm" onClick={() => saveCase(c.id)} disabled={saving}><Save className="h-3.5 w-3.5 me-1" />{saving ? t('common.loading') : t('common.save')}</Button>
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

          {/* Right Column - 30% - Calendar Sidebar */}
          <div className="lg:w-[30%] space-y-4">
            {/* Today's Appointments Quick View */}
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

            {/* Full Calendar */}
            {user && <AppointmentCalendar userId={user.id} cases={cases} leads={leads} />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LawyerDashboardPage;
