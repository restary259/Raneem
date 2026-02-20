import React from 'react';
import { Users, DollarSign, TrendingUp, UserCheck, Percent, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SparklineCard from './SparklineCard';
import FunnelVisualization from './FunnelVisualization';

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
  lawyers?: { id: string; full_name: string }[];
  influencers?: any[];
  onStageClick?: (stage: string) => void;
}

const AdminOverview: React.FC<AdminOverviewProps> = ({
  totalStudents, newThisMonth, totalPayments, newContacts, totalDocuments, activeServices, totalInfluencers,
  leads = [], cases = [], rewards = [], lawyers = [], influencers = [],
  onStageClick,
}) => {
  const { t } = useTranslation('dashboard');

  // KPI calculations
  const today = new Date().toISOString().slice(0, 10);
  const newLeadsToday = leads.filter(l => l.created_at?.startsWith(today)).length;

  const eligibleCount = leads.filter(l => l.status !== 'not_eligible').length;
  const eligiblePct = leads.length > 0 ? Math.round((eligibleCount / leads.length) * 100) : 0;

  const paidCases = cases.filter(c => ['paid', 'completed', 'ready_to_apply', 'registration_submitted', 'visa_stage', 'settled'].includes(c.case_status));
  const conversionRate = leads.length > 0 ? Math.round((paidCases.length / leads.length) * 100) : 0;

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const revenueThisMonth = cases
    .filter(c => ['paid', 'completed'].includes(c.case_status) && c.paid_at?.startsWith(currentMonth))
    .reduce((sum: number, c: any) => sum + (Number(c.service_fee) || 0) + (Number(c.school_commission) || 0), 0);

  const housingCommission = cases
    .filter(c => c.case_status === 'ready_to_apply')
    .reduce((sum: number, c: any) => sum + (Number(c.school_commission) || 0), 0);

  const infRevenue = cases
    .filter(c => ['paid', 'completed'].includes(c.case_status))
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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
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
          sparkData={spark7d(cases.filter(c => ['paid', 'completed'].includes(c.case_status)), 'paid_at')}
        />
        <SparklineCard
          icon={DollarSign} label={t('admin.overview.housingCommission')}
          value={housingCommission > 0 ? `${housingCommission.toLocaleString()} ₪` : '0 ₪'} color="bg-teal-600"
        />
        <SparklineCard
          icon={BarChart3} label={t('admin.overview.influencerROI')}
          value={infROI > 0 ? `${infROI}x` : '—'} color="bg-violet-600"
          subtext={infPayouts > 0 ? `${infRevenue.toLocaleString()} / ${infPayouts.toLocaleString()} ₪` : undefined}
        />
      </div>

      {/* Funnel */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('admin.overview.funnelTitle')}</h3>
        <FunnelVisualization leadCounts={leadCounts} caseCounts={caseCounts} onStageClick={onStageClick} />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SparklineCard icon={Users} label={t('admin.overview.totalStudents')} value={totalStudents} color="bg-blue-500" subtext={`+${newThisMonth} ${t('admin.overview.newThisMonth')}`} />
        <SparklineCard icon={UserCheck} label={t('admin.overview.agents')} value={totalInfluencers} color="bg-violet-500" />
        <SparklineCard icon={DollarSign} label={t('admin.overview.totalPayments')} value={`${totalPayments.toLocaleString()} ₪`} color="bg-emerald-500" />
        <SparklineCard icon={Users} label={t('admin.overview.newMessages')} value={newContacts} color="bg-amber-500" />
      </div>
    </div>
  );
};

export default AdminOverview;
