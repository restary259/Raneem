import React, { useMemo } from 'react';
import { Users, DollarSign, TrendingUp, UserCheck, Percent, BarChart3, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import SparklineCard from './SparklineCard';
import FunnelVisualization from './FunnelVisualization';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface AdminOverviewProps {
  totalStudents: number;
  newThisMonth: number;
  totalPayments: number;
  newContacts: number;
  totalDocuments: number;
  activeServices: number;
  totalInfluencers: number;
  leads?: any[];
  cases?: any[];
  rewards?: any[];
  commissions?: any[];
  lawyers?: { id: string; full_name: string }[];
  influencers?: any[];
  onStageClick?: (stage: string) => void;
}

const AdminOverview: React.FC<AdminOverviewProps> = ({
  totalStudents, newThisMonth, totalPayments, newContacts, totalDocuments, activeServices, totalInfluencers,
  leads = [], cases = [], rewards = [], commissions = [], lawyers = [], influencers = [],
  onStageClick,
}) => {
  const { t } = useTranslation('dashboard');

  // KPI calculations
  const today = new Date().toISOString().slice(0, 10);
  const newLeadsToday = leads.filter(l => l.created_at?.startsWith(today)).length;

  const eligibleCount = leads.filter(l => l.status !== 'not_eligible').length;
  const eligiblePct = leads.length > 0 ? Math.round((eligibleCount / leads.length) * 100) : 0;

  const paidCases = cases.filter(c => c.case_status === 'paid');
  const conversionRate = leads.length > 0 ? Math.round((paidCases.length / leads.length) * 100) : 0;

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const revenueThisMonth = cases
    .filter(c => c.case_status === 'paid' && c.paid_at?.startsWith(currentMonth))
    .reduce((sum: number, c: any) => sum + (Number(c.service_fee) || 0) + (Number(c.school_commission) || 0), 0);

  const infRevenue = cases
    .filter(c => c.case_status === 'paid')
    .reduce((sum: number, c: any) => sum + (Number(c.service_fee) || 0) + (Number(c.school_commission) || 0), 0);
  const infPayouts = rewards.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
  const infROI = infPayouts > 0 ? Math.round((infRevenue / infPayouts) * 100) / 100 : 0;

  // Sparkline data (last 7 days)
  const spark7d = (items: any[], dateField = 'created_at') => {
    const result: { v: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const day = d.toISOString().slice(0, 10);
      result.push({ v: items.filter(item => item[dateField]?.startsWith(day)).length });
    }
    return result;
  };

  // Funnel counts
  const leadCounts: Record<string, number> = {};
  leads.forEach(l => { leadCounts[l.status] = (leadCounts[l.status] || 0) + 1; });
  const caseCounts: Record<string, number> = {};
  cases.forEach(c => { caseCounts[c.case_status] = (caseCounts[c.case_status] || 0) + 1; });

  // Analytics data (absorbed from AdminAnalytics)
  const analytics = useMemo(() => {
    const paidAll = cases.filter(c => c.paid_at);
    const slaThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const slaWarnings = leads.filter(l => l.status === 'new' && new Date(l.created_at) < slaThreshold).length;

    // Team performance
    const teamPerf = lawyers.map(tm => {
      const assigned = cases.filter(c => c.assigned_lawyer_id === tm.id);
      const paid = assigned.filter(c => c.paid_at);
      return {
        name: tm.full_name,
        assigned: assigned.length,
        paid: paid.length,
        revenue: paid.reduce((s: number, c: any) => s + (Number(c.service_fee) || 0) + (Number(c.school_commission) || 0), 0),
        commission: paid.reduce((s: number, c: any) => s + (Number(c.lawyer_commission) || 0), 0),
      };
    });

    // Influencer performance
    const infPerf = influencers.map(inf => {
      const infLeads = leads.filter(l => l.source_type === 'influencer' && l.source_id === inf.id);
      const infCases = cases.filter(c => {
        const lead = leads.find(l => l.id === c.lead_id);
        return lead?.source_type === 'influencer' && lead?.source_id === inf.id;
      });
      const infPaid = infCases.filter(c => c.paid_at);
      return {
        name: inf.full_name,
        leads: infLeads.length,
        paid: infPaid.length,
        commission: infPaid.reduce((s: number, c: any) => s + (Number(c.influencer_commission) || 0), 0),
      };
    });

    // Monthly chart data (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('en', { month: 'short' });
      const mCases = paidAll.filter(c => c.paid_at?.startsWith(month));
      monthlyData.push({
        month: label,
        revenue: mCases.reduce((s: number, c: any) => s + (Number(c.service_fee) || 0) + (Number(c.school_commission) || 0), 0),
        teamComm: mCases.reduce((s: number, c: any) => s + (Number(c.lawyer_commission) || 0), 0),
        infComm: mCases.reduce((s: number, c: any) => s + (Number(c.influencer_commission) || 0), 0),
      });
    }

    return { slaWarnings, teamPerf, infPerf, monthlyData };
  }, [leads, cases, rewards, commissions, lawyers, influencers]);

  return (
    <div className="space-y-6">
      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SparklineCard
          icon={Users} label={t('admin.overview.newLeadsToday')}
          value={newLeadsToday} color="bg-blue-600"
          sparkData={spark7d(leads)} subtext={`${leads.length} ${t('admin.overview.totalLabel')}`}
        />
        <SparklineCard
          icon={Percent} label={t('admin.overview.eligiblePct')}
          value={`${eligiblePct}%`} color="bg-cyan-600"
          subtext={`${eligibleCount} / ${leads.length}`}
        />
        <SparklineCard
          icon={TrendingUp} label={t('admin.overview.conversionRate')}
          value={`${conversionRate}%`} color="bg-indigo-600"
          subtext={`${paidCases.length} ${t('admin.overview.converted')}`}
        />
        <SparklineCard
          icon={DollarSign} label={t('admin.overview.revenueThisMonth')}
          value={revenueThisMonth > 0 ? `${revenueThisMonth.toLocaleString()} ₪` : '0 ₪'} color="bg-emerald-600"
          sparkData={spark7d(cases.filter(c => c.case_status === 'paid'), 'paid_at')}
        />
        <SparklineCard
          icon={UserCheck} label={t('admin.overview.activeCases')}
          value={cases.filter(c => c.case_status !== 'paid').length} color="bg-teal-600"
          subtext={`${cases.length} ${t('admin.overview.totalLabel')}`}
        />
        <SparklineCard
          icon={AlertTriangle} label={t('admin.analytics.slaWarnings')}
          value={analytics.slaWarnings} color={analytics.slaWarnings > 0 ? 'bg-red-600' : 'bg-violet-600'}
          subtext={analytics.slaWarnings > 0 ? undefined : '—'}
        />
      </div>

      {/* Funnel */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('admin.overview.funnelTitle')}</h3>
        <FunnelVisualization leadCounts={leadCounts} caseCounts={caseCounts} onStageClick={onStageClick} />
      </div>

      {/* Monthly Revenue Chart */}
      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">{t('admin.analytics.monthlyBreakdown')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(val: number) => `${val.toLocaleString()} ₪`} />
              <Legend />
              <Bar dataKey="revenue" name={t('admin.analytics.revenue')} fill="hsl(24, 95%, 53%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="teamComm" name={t('admin.analytics.teamComm')} fill="hsl(215, 20%, 65%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="infComm" name={t('admin.analytics.infComm')} fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SparklineCard icon={Users} label={t('admin.overview.totalStudents')} value={totalStudents} color="bg-blue-500" subtext={`+${newThisMonth} ${t('admin.overview.newThisMonth')}`} />
        <SparklineCard icon={UserCheck} label={t('admin.overview.agents')} value={totalInfluencers} color="bg-violet-500" />
        <SparklineCard icon={DollarSign} label={t('admin.overview.totalPayments')} value={`${totalPayments.toLocaleString()} ₪`} color="bg-emerald-500" />
        <SparklineCard icon={Users} label={t('admin.overview.newMessages')} value={newContacts} color="bg-amber-500" />
      </div>

      {/* Team Performance Table */}
      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('admin.analytics.teamPerformance')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-start whitespace-nowrap">{t('admin.analytics.name')}</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">{t('admin.analytics.assigned')}</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">{t('admin.analytics.paid')}</th>
                  <th className="px-3 py-2 text-end whitespace-nowrap">{t('admin.analytics.revenue')}</th>
                  <th className="px-3 py-2 text-end whitespace-nowrap">{t('admin.analytics.commission')}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.teamPerf.map((tm, i) => (
                  <tr key={i} className={`border-b last:border-0 hover:bg-muted/50 transition-colors ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{tm.name}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{tm.assigned}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{tm.paid}</td>
                    <td className="px-3 py-2 text-end whitespace-nowrap">{tm.revenue.toLocaleString()} ₪</td>
                    <td className="px-3 py-2 text-end whitespace-nowrap">{tm.commission.toLocaleString()} ₪</td>
                  </tr>
                ))}
                {analytics.teamPerf.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-12 text-center">
                    <UserCheck className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">—</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Influencer Performance Table */}
      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('admin.analytics.influencerPerformance')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-start whitespace-nowrap">{t('admin.analytics.name')}</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">{t('admin.analytics.leadsGenerated')}</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">{t('admin.analytics.paid')}</th>
                  <th className="px-3 py-2 text-end whitespace-nowrap">{t('admin.analytics.commission')}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.infPerf.map((inf, i) => (
                  <tr key={i} className={`border-b last:border-0 hover:bg-muted/50 transition-colors ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{inf.name}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{inf.leads}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{inf.paid}</td>
                    <td className="px-3 py-2 text-end whitespace-nowrap">{inf.commission.toLocaleString()} ₪</td>
                  </tr>
                ))}
                {analytics.infPerf.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-12 text-center">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">—</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
