import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useDirection } from '@/hooks/useDirection';
import { useTranslation } from 'react-i18next';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import PullToRefresh from '@/components/common/PullToRefresh';
import { User } from '@supabase/supabase-js';
import { Users, TrendingUp, DollarSign, Link, Target, CheckCircle, CreditCard, Clock, XCircle, LogOut, ArrowLeftCircle, BarChart3, Timer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import EarningsPanel from '@/components/influencer/EarningsPanel';
import ReferralLink from '@/components/influencer/ReferralLink';
import NotificationBell from '@/components/common/NotificationBell';

type TabId = 'analytics' | 'students' | 'earnings' | 'my-link';

const TAB_CONFIG: { id: TabId; icon: React.ComponentType<{ className?: string }>; labelKey: string }[] = [
  { id: 'analytics', icon: BarChart3, labelKey: 'analytics' },
  { id: 'students', icon: Users, labelKey: 'students' },
  { id: 'earnings', icon: DollarSign, labelKey: 'earnings' },
  { id: 'my-link', icon: Link, labelKey: 'referralLink' },
];

const STUDENT_FILTERS = ['all', 'eligible', 'ineligible', 'paid'] as const;
type StudentFilter = typeof STUDENT_FILTERS[number];

const LOCK_DAYS = 20;

const InfluencerDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('analytics');
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { dir } = useDirection();
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

  const safeQuery = (p: Promise<any>) => p.catch(err => ({ data: null, error: err }));

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [leadsRes, casesRes] = await Promise.all([
      safeQuery((supabase as any).from('leads').select('*').eq('source_id', user.id).order('created_at', { ascending: false })),
      safeQuery((supabase as any).from('student_cases').select('*, leads!inner(source_id)').eq('leads.source_id', user.id)),
    ]);
    if (leadsRes.error) console.error('Leads fetch failed:', leadsRes.error);
    if (leadsRes.data) setLeads(leadsRes.data);
    if (casesRes.error) console.error('Cases fetch failed:', casesRes.error);
    if (casesRes.data) setCases(casesRes.data);
  }, [user]);

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
      setIsLoading(false);
    };
    init();
  }, [navigate, toast, t]);

  // Fetch data once user is set
  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  // Real-time subscriptions
  useRealtimeSubscription('leads', fetchData, !!user);
  useRealtimeSubscription('student_cases', fetchData, !!user);
  useRealtimeSubscription('rewards', fetchData, !!user);
  useRealtimeSubscription('payout_requests', fetchData, !!user);
  useRealtimeSubscription('commissions', fetchData, !!user);

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/'); };

  // Stats
  const totalLeads = leads.length;
  const eligibleLeads = leads.filter(l => (l.eligibility_score ?? 0) >= 50).length;
  const ineligibleLeads = leads.filter(l => (l.eligibility_score ?? 0) < 50 && l.status !== 'new').length;
  const paidCases = cases.filter(c => c.case_status === 'paid' || c.paid_at).length;

  // Funnel data for chart
  const funnelData = useMemo(() => [
    { name: t('influencerDash.kpi.funnelSubmitted'), value: totalLeads, fill: 'hsl(var(--primary))' },
    { name: t('influencerDash.kpi.funnelEligible'), value: eligibleLeads, fill: 'hsl(160, 60%, 45%)' },
    { name: t('influencerDash.kpi.funnelPaid'), value: paidCases, fill: 'hsl(130, 60%, 40%)' },
  ], [totalLeads, eligibleLeads, paidCases, t]);

  // Filtered students
  const filteredLeads = useMemo(() => {
    if (studentFilter === 'all') return leads;
    if (studentFilter === 'eligible') return leads.filter(l => (l.eligibility_score ?? 0) >= 50);
    if (studentFilter === 'ineligible') return leads.filter(l => (l.eligibility_score ?? 0) < 50 && l.status !== 'new');
    if (studentFilter === 'paid') {
      const paidLeadIds = new Set(cases.filter(c => c.paid_at).map(c => c.lead_id));
      return leads.filter(l => paidLeadIds.has(l.id));
    }
    return leads;
  }, [leads, cases, studentFilter]);

  // Get case for a lead
  const getCaseForLead = (leadId: string) => cases.find(c => c.lead_id === leadId);

  // 20-day timer
  const getTimerInfo = (paidAt: string | null) => {
    if (!paidAt) return null;
    const elapsed = Math.floor((Date.now() - new Date(paidAt).getTime()) / (1000 * 60 * 60 * 24));
    const remaining = LOCK_DAYS - elapsed;
    return { elapsed, remaining, ready: remaining <= 0 };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20" dir={dir}>
      {/* Header */}
      <header className="bg-[hsl(222,47%,17%)] text-white">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" alt="Darb" className="w-8 h-8 object-contain shrink-0" />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold leading-tight truncate">
                  <span className="hidden sm:inline">{t('influencerDash.title')}</span>
                  <span className="sm:hidden">{isAr ? 'مرحبًا' : 'Hi'}, {profile?.full_name?.split(' ')[0] || ''} 👋</span>
                </h1>
                <p className="hidden sm:block text-xs text-white/60 truncate">{profile?.full_name || user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <NotificationBell />
              <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10 h-9 w-9" onClick={() => navigate('/')}>
                <ArrowLeftCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10 h-9 w-9" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-3 sm:py-5 space-y-3 sm:space-y-5">
        <PullToRefresh onRefresh={async () => { await fetchData(); }}>
        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
              <KPICard icon={Users} label={t('influencerDash.kpi.totalSubmissions')} value={totalLeads} color="text-blue-600" />
              <KPICard icon={Target} label={t('influencerDash.kpi.eligible')} value={eligibleLeads} color="text-emerald-600" />
              <KPICard icon={XCircle} label={t('influencerDash.kpi.ineligible')} value={ineligibleLeads} color="text-red-500" />
              <KPICard icon={CreditCard} label={t('influencerDash.kpi.convertedPaid')} value={paidCases} color="text-green-600" />
            </div>

            {/* Funnel Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('influencerDash.kpi.conversionFunnel')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
                      {funnelData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <PullToRefresh onRefresh={async () => { await fetchData(); }}>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STUDENT_FILTERS.map(f => (
                <button key={f} onClick={() => setStudentFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    studentFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}>
                  {f === 'all' ? t('influencerDash.studentFilters.all')
                    : f === 'eligible' ? t('influencerDash.studentFilters.eligible')
                    : f === 'ineligible' ? t('influencerDash.studentFilters.ineligible')
                    : t('influencerDash.studentFilters.paid')}
                </button>
              ))}
            </div>

            {/* Student Cards */}
            {filteredLeads.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground text-sm">{t('influencerDash.noStudents')}</p>
            ) : (
              <div className="space-y-2">
                {filteredLeads.map(lead => {
                  const score = lead.eligibility_score ?? 0;
                  const isEligible = score >= 50;
                  const linkedCase = getCaseForLead(lead.id);
                  const isPaid = linkedCase?.paid_at != null;
                  const timerInfo = isPaid ? getTimerInfo(linkedCase.paid_at) : null;

                  // Anonymize
                  const initials = lead.full_name
                    ? lead.full_name.split(' ').map((w: string) => w.charAt(0)).join('.') + '.'
                    : '—';

                  return (
                    <Card key={lead.id}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{initials}</p>
                          <div className="flex items-center gap-2">
                            {isPaid ? (
                              <Badge variant="default" className="bg-green-600 text-xs">{t('influencerDash.studentCard.statusPaid')}</Badge>
                            ) : isEligible ? (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-xs">{t('influencerDash.studentCard.statusEligible')}</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">{t('influencerDash.studentCard.statusIneligible')}</Badge>
                            )}
                          </div>
                        </div>

                        {/* Payment status row */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {t('influencerDash.studentCard.payment')} {isPaid ? t('influencerDash.studentCard.paid') : t('influencerDash.studentCard.notPaid')}
                          </span>
                        </div>

                        {/* 20-day Timer */}
                        {timerInfo && (
                          <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                            timerInfo.ready ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'
                          }`}>
                            <Timer className="h-4 w-4 shrink-0" />
                            {timerInfo.ready
                              ? t('influencerDash.studentCard.readyPayout')
                              : t('influencerDash.studentCard.daysLeft', { count: timerInfo.remaining })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
          </PullToRefresh>
        )}

        {/* Earnings Tab */}
        {activeTab === 'earnings' && user && <EarningsPanel userId={user.id} />}

        {/* My Link Tab */}
        {activeTab === 'my-link' && user && <ReferralLink userId={user.id} />}
        </PullToRefresh>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-border z-50 safe-area-pb">
        <div className="max-w-7xl mx-auto flex">
          {TAB_CONFIG.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}>
                <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : ''}`} />
                <span className="text-[10px] font-medium">{t(`influencerDash.tabs.${tab.labelKey}`)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

/* --- Sub-components --- */

const KPICard = ({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string }) => (
  <Card>
    <CardContent className="p-4 text-center">
      <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </CardContent>
  </Card>
);

export default InfluencerDashboardPage;
