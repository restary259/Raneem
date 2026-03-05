import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, DollarSign, TrendingUp, Link2, ArrowRight, Award } from 'lucide-react';
import DashboardLoading from '@/components/dashboard/DashboardLoading';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useDirection } from '@/hooks/useDirection';

export default function PartnerOverviewPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, eligible: 0, paid: 0, pendingEarnings: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('dashboard');
  const { dir } = useDirection();
  const isAr = i18n.language === 'ar';

  const load = useCallback(async (uid: string) => {
    const [profRes, casesRes, rewardsRes] = await Promise.all([
      (supabase as any).from('profiles').select('full_name,email').eq('id', uid).maybeSingle(),
      (supabase as any).from('cases').select('id,full_name,status,created_at').eq('partner_id', uid).order('created_at', { ascending: false }).limit(50),
      (supabase as any).from('rewards').select('amount,status').eq('user_id', uid),
    ]);

    if (profRes.data) setProfile(profRes.data);

    const cases = casesRes.data || [];
    const rewards = rewardsRes.data || [];
    const pendingEarnings = rewards.filter((r: any) => r.status === 'pending').reduce((s: number, r: any) => s + Number(r.amount), 0);

    setStats({
      total: cases.length,
      eligible: cases.filter((c: any) => c.status !== 'new').length,
      paid: cases.filter((c: any) => c.status === 'enrollment_paid').length,
      pendingEarnings,
    });
    setRecentLeads(cases.slice(0, 5));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate('/student-auth'); return; }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, [navigate, load]);

  if (!userId) return <DashboardLoading />;

  const kpis = [
    { label: t('partner.kpi.totalStudents', 'Total Students'), value: stats.total, icon: <Users className="h-5 w-5" />, color: 'text-blue-600 bg-blue-50' },
    { label: t('partner.kpi.eligible', 'Active Cases'), value: stats.eligible, icon: <TrendingUp className="h-5 w-5" />, color: 'text-emerald-600 bg-emerald-50' },
    { label: t('partner.kpi.paid', 'Paid'), value: stats.paid, icon: <Award className="h-5 w-5" />, color: 'text-purple-600 bg-purple-50' },
    { label: t('partner.kpi.pendingEarnings', 'Pending Earnings'), value: `₪${stats.pendingEarnings.toLocaleString()}`, icon: <DollarSign className="h-5 w-5" />, color: 'text-amber-600 bg-amber-50' },
  ];

  const funnelData = [
    { name: t('partner.funnel.submitted', 'Submitted'), value: stats.total },
    { name: t('partner.funnel.active', 'Active'), value: stats.eligible },
    { name: t('partner.funnel.paid', 'Paid'), value: stats.paid },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('partner.welcome', 'Welcome back')}{profile?.full_name ? `, ${profile.full_name}` : ''}! 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('partner.subtitle', 'Track your referrals and earnings')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-2 ${kpi.color}`}>
                {kpi.icon}
              </div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('partner.funnel.title', 'Conversion Funnel')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={funnelData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => [v, t('partner.funnel.students', 'Students')]} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Button asChild variant="outline" className="h-14 justify-between px-5">
          <Link to="/partner/link">
            <span className="flex items-center gap-2"><Link2 className="h-4 w-4" />{t('partner.shareLink', 'Share My Link')}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-14 justify-between px-5">
          <Link to="/partner/earnings">
            <span className="flex items-center gap-2"><DollarSign className="h-4 w-4" />{t('partner.requestPayout', 'Request Payout')}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Recent students */}
      {recentLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('partner.recentStudents', 'Recent Students')}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-foreground">{lead.full_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString(isAr ? 'ar' : 'en-GB')}</p>
                </div>
                <Badge variant="outline" className="text-xs capitalize">{lead.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
