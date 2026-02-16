import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, CalendarDays, CreditCard, AlertTriangle, DollarSign, TrendingUp, Briefcase, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isToday, differenceInHours, format } from 'date-fns';

interface OverviewTabProps {
  cases: any[];
  leads: any[];
  appointments: any[];
}

const OverviewTab = ({ cases, leads, appointments }: OverviewTabProps) => {
  const { t } = useTranslation('dashboard');

  const now = new Date();

  const activeLeads = cases.filter(c => !['paid', 'settled', 'completed'].includes(c.case_status)).length;
  const todayAppts = appointments.filter(a => isToday(new Date(a.scheduled_at))).length;
  const paidThisMonth = cases.filter(c => {
    if (!c.paid_at) return false;
    const d = new Date(c.paid_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const slaWarnings = cases.filter(c => {
    if (c.case_status !== 'assigned') return false;
    const lead = leads.find((l: any) => l.id === c.lead_id);
    if (lead?.last_contacted) return false;
    return differenceInHours(now, new Date(c.created_at)) > 24;
  }).length;
  const totalEarnings = cases.filter(c => c.paid_at).reduce((s: number, c: any) => s + (Number(c.lawyer_commission) || 0), 0);
  const totalRevenue = cases.filter(c => c.paid_at).reduce((s: number, c: any) => s + (Number(c.service_fee) || 0), 0);
  const casesToday = cases.filter(c => isToday(new Date(c.created_at))).length;
  const pendingTasks = cases.filter(c => c.case_status === 'assigned').length;

  const todayAppointmentsList = appointments.filter(a => isToday(new Date(a.scheduled_at)));

  // Status distribution
  const statusCounts: Record<string, number> = {};
  cases.forEach(c => {
    statusCounts[c.case_status] = (statusCounts[c.case_status] || 0) + 1;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h2 className="font-bold text-lg flex items-center gap-2">
        <TrendingUp className="h-5 w-5" />
        {t('lawyer.overviewTab', 'Overview & Analytics')}
      </h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard icon={<DollarSign className="h-5 w-5 text-emerald-600" />} label={t('lawyer.kpi.totalRevenue', 'Total Revenue')} value={`${totalRevenue.toLocaleString()} ₪`} accent="emerald" />
        <MetricCard icon={<DollarSign className="h-5 w-5 text-green-600" />} label={t('lawyer.kpi.myEarnings', 'My Earnings')} value={`${totalEarnings.toLocaleString()} ₪`} accent="green" />
        <MetricCard icon={<Briefcase className="h-5 w-5 text-blue-600" />} label={t('lawyer.overview.casesToday', 'Cases Today')} value={String(casesToday)} accent="blue" />
        <MetricCard icon={<CreditCard className="h-5 w-5 text-purple-600" />} label={t('lawyer.kpi.paidThisMonth')} value={String(paidThisMonth)} accent="purple" />
        <MetricCard icon={<CalendarDays className="h-5 w-5 text-indigo-600" />} label={t('lawyer.kpi.todayAppts')} value={String(todayAppts)} accent="indigo" />
        <MetricCard icon={<Users className="h-5 w-5 text-blue-600" />} label={t('lawyer.kpi.activeLeads')} value={String(activeLeads)} accent="blue" />
        <MetricCard icon={<Clock className="h-5 w-5 text-orange-600" />} label={t('lawyer.overview.pendingTasks', 'Pending Tasks')} value={String(pendingTasks)} accent="orange" />
        <MetricCard icon={<AlertTriangle className={`h-5 w-5 ${slaWarnings > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />} label={t('lawyer.kpi.slaWarnings')} value={String(slaWarnings)} accent={slaWarnings > 0 ? 'red' : 'gray'} />
      </div>

      {/* Status Distribution */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3">{t('lawyer.overview.statusDistribution', 'Case Status Distribution')}</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <Badge key={status} variant="secondary" className="text-xs px-3 py-1">
                {t(`lawyer.statuses.${status}`, status)}: {count}
              </Badge>
            ))}
            {Object.keys(statusCounts).length === 0 && (
              <p className="text-sm text-muted-foreground">{t('lawyer.noCases')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Today's Appointments */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-purple-600" />
            {t('lawyer.todaySchedule', "Today's Schedule")}
          </h3>
          {todayAppointmentsList.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('admin.appointments.noAppointments')}</p>
          ) : (
            <div className="space-y-2">
              {todayAppointmentsList.map(appt => (
                <div key={appt.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
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
          )}
        </CardContent>
      </Card>

      {/* SLA Alerts */}
      {slaWarnings > 0 && (
        <Card className="border-destructive/50">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {t('lawyer.overview.slaAlerts', 'SLA Alerts')}
            </h3>
            <div className="space-y-2">
              {cases.filter(c => {
                if (c.case_status !== 'assigned') return false;
                const lead = leads.find((l: any) => l.id === c.lead_id);
                if (lead?.last_contacted) return false;
                return differenceInHours(now, new Date(c.created_at)) > 24;
              }).map(c => {
                const lead = leads.find((l: any) => l.id === c.lead_id);
                const hours = differenceInHours(now, new Date(c.created_at));
                return (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-red-50 rounded-lg text-sm">
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

function MetricCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className="mx-auto mb-2 flex justify-center">{icon}</div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

export default OverviewTab;
