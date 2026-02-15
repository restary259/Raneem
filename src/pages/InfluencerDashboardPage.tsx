import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useDirection } from '@/hooks/useDirection';
import { useTranslation } from 'react-i18next';
import { User } from '@supabase/supabase-js';
import { Users, TrendingUp, ClipboardCheck, LogOut, ArrowLeftCircle, DollarSign, Link, Target, CheckCircle, CreditCard, Clock, XCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import EarningsPanel from '@/components/influencer/EarningsPanel';

import ReferralLink from '@/components/influencer/ReferralLink';
import NotificationBell from '@/components/common/NotificationBell';

type TabId = 'overview' | 'students' | 'earnings' | 'referral-link';

const TAB_ICONS: Record<TabId, React.ComponentType<{ className?: string }>> = {
  overview: TrendingUp,
  students: Users,
  earnings: DollarSign,
  'referral-link': Link,
};

const TAB_IDS: TabId[] = ['overview', 'students', 'earnings', 'referral-link'];

const STATUS_COLORS: Record<string, string> = {
  new: 'hsl(220, 70%, 55%)',
  eligible: 'hsl(160, 60%, 45%)',
  not_eligible: 'hsl(0, 65%, 55%)',
  assigned: 'hsl(270, 55%, 55%)',
  contacted: 'hsl(40, 70%, 50%)',
};

const InfluencerDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [studentChecklists, setStudentChecklists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
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
        .from('user_roles').select('role').eq('user_id', session.user.id).eq('role', 'influencer');
      if (!roles?.length) {
        toast({ variant: 'destructive', title: t('influencerDash.unauthorized'), description: t('influencerDash.unauthorizedDesc') });
        navigate('/'); return;
      }

      const { data: prof } = await (supabase as any).from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (prof) setProfile(prof);

      const { data: myLeads } = await (supabase as any)
        .from('leads').select('*').eq('source_id', session.user.id).order('created_at', { ascending: false });
      if (myLeads) setLeads(myLeads);

      const { data: assignedStudents } = await (supabase as any)
        .from('profiles').select('*').eq('influencer_id', session.user.id).order('created_at', { ascending: false });
      if (assignedStudents) setStudents(assignedStudents);

      const [itemsRes, checklistsRes] = await Promise.all([
        (supabase as any).from('checklist_items').select('*').order('sort_order', { ascending: true }),
        (supabase as any).from('student_checklist').select('*'),
      ]);
      if (itemsRes.data) setChecklistItems(itemsRes.data);
      if (checklistsRes.data) setStudentChecklists(checklistsRes.data);
      setIsLoading(false);
    };
    init();
  }, [navigate, toast]);

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/'); };

  const getProgress = (studentId: string) => {
    const total = checklistItems.length;
    if (!total) return 0;
    return Math.round((studentChecklists.filter(sc => sc.student_id === studentId && sc.is_completed).length / total) * 100);
  };

  const totalLeads = leads.length;
  const eligibleLeads = leads.filter(l => (l.eligibility_score ?? 0) >= 50).length;
  const paidStudents = students.filter(s => s.student_status === 'paid').length;
  const totalConverted = students.filter(s => s.student_status === 'converted' || s.student_status === 'paid').length;
  const avgProgress = students.length > 0 ? Math.round(students.reduce((sum, s) => sum + getProgress(s.id), 0) / students.length) : 0;
  const conversionRate = totalLeads > 0 ? Math.round((paidStudents / totalLeads) * 100) : 0;

  // Lead status breakdown for pie chart
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      name: t(`influencerDash.leadStatuses.${status}`, status),
      value: count,
      color: STATUS_COLORS[status] || 'hsl(210, 10%, 60%)',
    }));
  }, [leads, t]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir={dir}>
      <header className="bg-[#1E293B] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" alt="Darb" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="text-xl font-bold">{t('influencerDash.title')}</h1>
                <p className="text-sm text-white/70">{t('influencerDash.welcome', { name: profile?.full_name || user?.email })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate('/')}>
                <ArrowLeftCircle className="h-4 w-4 me-2" />{t('lawyer.website')}
              </Button>
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 me-2" />{t('lawyer.signOut')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 flex-wrap border-b pb-2">
          {TAB_IDS.map(tabId => {
            const Icon = TAB_ICONS[tabId];
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tabId
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(`influencerDash.tabs.${tabId === 'referral-link' ? 'referralLink' : tabId}`)}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card><CardContent className="p-4 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                <p className="text-xs text-muted-foreground">{t('influencerDash.totalClients')}</p>
                <p className="text-xl font-bold">{totalLeads}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <Target className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                <p className="text-xs text-muted-foreground">{t('influencerDash.eligible')}</p>
                <p className="text-xl font-bold">{eligibleLeads}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <CheckCircle className="h-5 w-5 mx-auto mb-1 text-purple-600" />
                <p className="text-xs text-muted-foreground">{t('influencerDash.converted')}</p>
                <p className="text-xl font-bold">{totalConverted}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <CreditCard className="h-5 w-5 mx-auto mb-1 text-green-600" />
                <p className="text-xs text-muted-foreground">{t('influencerDash.paid')}</p>
                <p className="text-xl font-bold">{paidStudents}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                <p className="text-xs text-muted-foreground">{t('influencerDash.convRate', { defaultValue: 'Conversion' })}</p>
                <p className="text-xl font-bold">{conversionRate}%</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <ClipboardCheck className="h-5 w-5 mx-auto mb-1 text-orange-600" />
                <p className="text-xs text-muted-foreground">{t('influencerDash.avgProgress')}</p>
                <p className="text-xl font-bold">{avgProgress}%</p>
              </CardContent></Card>
            </div>

            {/* Pipeline & Stats Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Lead Pipeline Pie Chart */}
              {statusBreakdown.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('influencerDash.leadPipeline', { defaultValue: 'Lead Pipeline' })}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={2}>
                          {statusBreakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {statusBreakdown.map((entry, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span>{entry.name}: {entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Conversion Funnel Mini */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('influencerDash.conversionFunnel', { defaultValue: 'Conversion Funnel' })}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: t('influencerDash.totalClients'), value: totalLeads, pct: 100, color: 'bg-blue-500' },
                    { label: t('influencerDash.eligible'), value: eligibleLeads, pct: totalLeads > 0 ? Math.round((eligibleLeads / totalLeads) * 100) : 0, color: 'bg-emerald-500' },
                    { label: t('influencerDash.converted'), value: totalConverted, pct: totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0, color: 'bg-purple-500' },
                    { label: t('influencerDash.paid'), value: paidStudents, pct: totalLeads > 0 ? Math.round((paidStudents / totalLeads) * 100) : 0, color: 'bg-green-500' },
                  ].map((stage, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{stage.label}</span>
                        <span className="font-medium">{stage.value} ({stage.pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${stage.color} rounded-full transition-all duration-500`} style={{ width: `${stage.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="space-y-3">
            {leads.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">{t('influencerDash.referredClients')}</h3>
                {leads.map(lead => {
                  const score = lead.eligibility_score ?? 0;
                  const isEligible = score >= 50;
                  const st = {
                    label: t(`influencerDash.leadStatuses.${lead.status}`, lead.status),
                    color: ({
                      new: 'bg-blue-100 text-blue-800',
                      eligible: 'bg-emerald-100 text-emerald-800',
                      not_eligible: 'bg-red-100 text-red-800',
                      assigned: 'bg-purple-100 text-purple-800',
                    } as Record<string, string>)[lead.status] || 'bg-blue-100 text-blue-800',
                  };
                  // Anonymize: show initials + city instead of full name
                  const initials = lead.full_name
                    ? lead.full_name.split(' ').map((w: string) => w.charAt(0)).join('.') + '.'
                    : '—';
                  const anonymizedName = lead.city ? `${initials} — ${lead.city}` : initials;

                  return (
                    <Card key={lead.id}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{anonymizedName}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${st.color}`}>{String(st.label)}</span>
                          </div>
                        </div>
                        <div className={`flex items-start gap-2 p-2 rounded-lg text-xs ${isEligible ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                          {isEligible ? (
                            <><CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{t('influencerDash.eligibleForApply')}</span></>
                          ) : (
                            <><XCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{t('influencerDash.notMeetReqs')}</span></>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {students.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">{t('influencerDash.enrolledStudents')}</h3>
                {students.map(s => {
                  const progress = getProgress(s.id);
                  const statusKey = s.student_status || 'eligible';
                  const statusColors: Record<string, string> = {
                    eligible: 'bg-emerald-100 text-emerald-800',
                    ineligible: 'bg-red-100 text-red-800',
                    converted: 'bg-blue-100 text-blue-800',
                    paid: 'bg-green-100 text-green-800',
                    nurtured: 'bg-purple-100 text-purple-800',
                  };
                  return (
                    <Card key={s.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-sm">{s.full_name}</p>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[statusKey] || statusColors.eligible}`}>
                            {String(t(`admin.students.statuses.${statusKey}`, { defaultValue: statusKey }))}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground">{progress}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {leads.length === 0 && students.length === 0 && (
              <p className="p-8 text-center text-muted-foreground">{t('influencerDash.noStudents')}</p>
            )}
          </div>
        )}
        {activeTab === 'earnings' && user && <EarningsPanel userId={user.id} />}
        
        {activeTab === 'referral-link' && user && <ReferralLink userId={user.id} />}
      </main>
    </div>
  );
};

export default InfluencerDashboardPage;
