import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { Users, CalendarDays, AlertTriangle, CreditCard, DollarSign, TrendingUp, CheckCircle } from 'lucide-react';
import { differenceInHours } from 'date-fns';

interface TeamAnalyticsTabProps {
  kpis: {
    activeLeads: number;
    todayAppts: number;
    paidThisMonth: number;
    slaWarnings: number;
    totalEarnings: number;
    totalServiceFees: number;
    conversionRate: number;
    showRate: number;
  };
  cases: any[];
  leads: any[];
  isSlaBreached: (c: any) => boolean;
}

const KPICard = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) => (
  <Card className={highlight ? 'border-destructive/50' : ''}>
    <CardContent className="p-3 text-center">
      <div className="mx-auto mb-1 w-fit">{icon}</div>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-destructive' : ''}`}>{value}</p>
    </CardContent>
  </Card>
);

const TeamAnalyticsTab: React.FC<TeamAnalyticsTabProps> = ({ kpis, cases, leads, isSlaBreached }) => {
  const { t } = useTranslation('dashboard');

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-sm flex items-center gap-2">
        <TrendingUp className="h-4 w-4" />{t('lawyer.tabs.analytics', 'Analytics')}
      </h2>
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
  );
};

export default TeamAnalyticsTab;
