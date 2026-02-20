import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { Users, TrendingUp, DollarSign, UserCheck, BarChart3, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface AdminAnalyticsProps {
  leads: any[];
  cases: any[];
  rewards: any[];
  commissions: any[];
  lawyers: any[];
  influencers: any[];
}

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({
  leads, cases, rewards, commissions, lawyers, influencers,
}) => {
  const { t } = useTranslation('dashboard');

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const paidCases = cases.filter(c => c.paid_at);
    const paidThisMonth = paidCases.filter(c => c.paid_at?.startsWith(currentMonth));

    const totalRevenue = paidCases.reduce((s, c) => s + (Number(c.service_fee) || 0), 0);
    const revenueThisMonth = paidThisMonth.reduce((s, c) => s + (Number(c.service_fee) || 0), 0);
    const totalTeamComm = paidCases.reduce((s, c) => s + (Number(c.lawyer_commission) || 0), 0);
    const totalInfluencerComm = paidCases.reduce((s, c) => s + (Number(c.influencer_commission) || 0), 0);
    const conversionRate = leads.length > 0 ? Math.round((paidCases.length / leads.length) * 100) : 0;

    // SLA: leads that are 'new' and older than 24h
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
        revenue: paid.reduce((s: number, c: any) => s + (Number(c.service_fee) || 0), 0),
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
      const mCases = paidCases.filter(c => c.paid_at?.startsWith(month));
      monthlyData.push({
        month: label,
        students: mCases.length,
        revenue: mCases.reduce((s: number, c: any) => s + (Number(c.service_fee) || 0), 0),
        teamComm: mCases.reduce((s: number, c: any) => s + (Number(c.lawyer_commission) || 0), 0),
        infComm: mCases.reduce((s: number, c: any) => s + (Number(c.influencer_commission) || 0), 0),
      });
    }

    return {
      totalRevenue, revenueThisMonth, totalTeamComm, totalInfluencerComm,
      conversionRate, slaWarnings, paidThisMonth: paidThisMonth.length,
      teamPerf, infPerf, monthlyData,
    };
  }, [leads, cases, rewards, commissions, lawyers, influencers]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: DollarSign, label: t('admin.analytics.totalRevenue'), value: `${stats.totalRevenue.toLocaleString()} ₪`, color: 'text-emerald-600', bg: 'border-s-[3px] border-s-emerald-500' },
          { icon: DollarSign, label: t('admin.analytics.revenueThisMonth'), value: `${stats.revenueThisMonth.toLocaleString()} ₪`, color: 'text-blue-600', bg: 'border-s-[3px] border-s-blue-500' },
          { icon: UserCheck, label: t('admin.analytics.paidThisMonth'), value: stats.paidThisMonth, color: 'text-green-600', bg: 'border-s-[3px] border-s-green-500' },
          { icon: TrendingUp, label: t('admin.analytics.conversionRate'), value: `${stats.conversionRate}%`, color: 'text-indigo-600', bg: 'border-s-[3px] border-s-indigo-500' },
          { icon: Users, label: t('admin.analytics.teamCommissions'), value: `${stats.totalTeamComm.toLocaleString()} ₪`, color: 'text-orange-600', bg: 'border-s-[3px] border-s-orange-500' },
          { icon: AlertTriangle, label: t('admin.analytics.slaWarnings'), value: stats.slaWarnings, color: stats.slaWarnings > 0 ? 'text-red-600' : 'text-muted-foreground', bg: stats.slaWarnings > 0 ? 'border-s-[3px] border-s-red-500' : '' },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={i} className={`hover:shadow-md transition-shadow ${card.bg}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${card.color}`} />
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                </div>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Monthly Chart */}
      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">{t('admin.analytics.monthlyBreakdown')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.monthlyData}>
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
                {stats.teamPerf.map((tm, i) => (
              <tr key={i} className={`border-b last:border-0 hover:bg-muted/50 transition-colors ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{tm.name}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{tm.assigned}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{tm.paid}</td>
                    <td className="px-3 py-2 text-end whitespace-nowrap">{tm.revenue.toLocaleString()} ₪</td>
                    <td className="px-3 py-2 text-end whitespace-nowrap">{tm.commission.toLocaleString()} ₪</td>
                  </tr>
                ))}
                {stats.teamPerf.length === 0 && (
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
                {stats.infPerf.map((inf, i) => (
                  <tr key={i} className={`border-b last:border-0 hover:bg-muted/50 transition-colors ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{inf.name}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{inf.leads}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{inf.paid}</td>
                    <td className="px-3 py-2 text-end whitespace-nowrap">{inf.commission.toLocaleString()} ₪</td>
                  </tr>
                ))}
                {stats.infPerf.length === 0 && (
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

export default AdminAnalytics;
