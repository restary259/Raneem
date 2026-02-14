import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TrendingUp, Users, BarChart3, CalendarIcon, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area, Legend,
} from 'recharts';

interface KPIAnalyticsProps {
  cases: any[];
  leads: any[];
  lawyers: { id: string; full_name: string }[];
  influencers: { id: string; full_name: string }[];
  commissions: any[];
}

function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const KPIAnalytics: React.FC<KPIAnalyticsProps> = ({ cases, leads, lawyers, influencers, commissions }) => {
  const { t } = useTranslation('dashboard');
  const [startDate, setStartDate] = useState<Date>(startOfMonth(subMonths(new Date(), 5)));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));

  // Filter cases and leads by date range
  const filteredCases = useMemo(() => cases.filter(c => {
    const d = new Date(c.paid_at || c.created_at);
    return isWithinInterval(d, { start: startDate, end: endDate });
  }), [cases, startDate, endDate]);

  const filteredLeads = useMemo(() => leads.filter(l => {
    const d = new Date(l.created_at);
    return isWithinInterval(d, { start: startDate, end: endDate });
  }), [leads, startDate, endDate]);

  const paidCases = filteredCases.filter(c => c.case_status === 'paid' || c.case_status === 'completed');
  const totalRevenue = paidCases.reduce((sum, c) => sum + (Number(c.service_fee) || 0) + (Number(c.school_commission) || 0), 0);
  const totalCosts = paidCases.reduce((sum, c) => sum + (Number(c.influencer_commission) || 0) + (Number(c.lawyer_commission) || 0) + (Number(c.referral_discount) || 0) + (Number(c.translation_fee) || 0), 0);
  const totalProfit = totalRevenue - totalCosts;
  const avgProfitPerStudent = paidCases.length > 0 ? Math.round(totalProfit / paidCases.length) : 0;

  // Monthly revenue trend
  const monthlyRevenue = useMemo(() => {
    const months: Record<string, { revenue: number; costs: number; profit: number }> = {};
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const key = format(cur, 'yyyy-MM');
      months[key] = { revenue: 0, costs: 0, profit: 0 };
      cur.setMonth(cur.getMonth() + 1);
    }
    paidCases.forEach(c => {
      const month = (c.paid_at || c.created_at)?.slice(0, 7);
      if (month && months[month]) {
        const rev = (Number(c.service_fee) || 0) + (Number(c.school_commission) || 0);
        const cost = (Number(c.influencer_commission) || 0) + (Number(c.lawyer_commission) || 0) + (Number(c.referral_discount) || 0) + (Number(c.translation_fee) || 0);
        months[month].revenue += rev;
        months[month].costs += cost;
        months[month].profit += rev - cost;
      }
    });
    return Object.entries(months).map(([month, data]) => ({ month: month.slice(5), ...data }));
  }, [paidCases, startDate, endDate]);

  // Conversion funnel data
  const funnelData = useMemo(() => {
    const stages = [
      { key: 'new', count: filteredLeads.filter(l => l.status === 'new').length },
      { key: 'eligible', count: filteredLeads.filter(l => l.status === 'eligible' || (l.eligibility_score ?? 0) >= 50).length },
      { key: 'assigned', count: filteredCases.filter(c => c.case_status === 'assigned').length },
      { key: 'contacted', count: filteredCases.filter(c => c.case_status === 'contacted').length },
      { key: 'appointment', count: filteredCases.filter(c => c.case_status === 'appointment').length },
      { key: 'paid', count: filteredCases.filter(c => c.case_status === 'paid').length },
      { key: 'ready_to_apply', count: filteredCases.filter(c => c.case_status === 'ready_to_apply').length },
      { key: 'completed', count: filteredCases.filter(c => c.case_status === 'completed' || c.case_status === 'settled').length },
    ];
    return stages.map(s => ({ name: t(`funnel.${s.key}`, s.key), count: s.count }));
  }, [filteredLeads, filteredCases, t]);

  // Agent comparison
  const agentData = useMemo(() => {
    return influencers.map(inf => {
      const infLeads = filteredLeads.filter(l => l.source_id === inf.id);
      const infCases = filteredCases.filter(c => {
        const lead = leads.find(l => l.id === c.lead_id);
        return lead?.source_id === inf.id;
      });
      const paid = infCases.filter(c => c.case_status === 'paid' || c.case_status === 'completed').length;
      return { name: inf.full_name?.split(' ')[0] || '?', leads: infLeads.length, paid };
    }).filter(a => a.leads > 0).slice(0, 8);
  }, [influencers, filteredLeads, filteredCases, leads]);

  // Team member performance
  const teamMemberData = useMemo(() => {
    return lawyers.map(lawyer => {
      const lc = filteredCases.filter(c => c.assigned_lawyer_id === lawyer.id);
      const closed = lc.filter(c => ['paid', 'completed', 'closed'].includes(c.case_status)).length;
      const closeRate = lc.length > 0 ? Math.round((closed / lc.length) * 100) : 0;
      const revenue = closed > 0 ? lc.filter(c => ['paid', 'completed'].includes(c.case_status)).reduce((s, c) => s + (Number(c.service_fee) || 0), 0) : 0;
      return { ...lawyer, total: lc.length, closed, closeRate, revenue };
    });
  }, [lawyers, filteredCases]);

  const FUNNEL_COLORS = ['hsl(220, 70%, 55%)', 'hsl(200, 65%, 50%)', 'hsl(180, 60%, 45%)', 'hsl(160, 55%, 45%)', 'hsl(140, 50%, 45%)', 'hsl(120, 55%, 40%)', 'hsl(90, 50%, 45%)', 'hsl(60, 60%, 45%)'];

  // Export handlers
  const exportRevenue = () => downloadCSV(monthlyRevenue.map(m => ({ Month: m.month, Revenue: m.revenue, Costs: m.costs, Profit: m.profit })), 'revenue-report');
  const exportLeads = () => downloadCSV(filteredLeads.map(l => ({ Name: l.full_name, Phone: l.phone, Status: l.status, Score: l.eligibility_score, Source: l.source_type, Date: l.created_at?.slice(0, 10) })), 'leads-report');
  const exportCases = () => downloadCSV(filteredCases.map(c => ({ CaseID: c.id?.slice(0, 8), Status: c.case_status, ServiceFee: c.service_fee, SchoolComm: c.school_commission, Created: c.created_at?.slice(0, 10) })), 'cases-report');

  const DatePicker = ({ date, onSelect, label }: { date: Date; onSelect: (d: Date) => void; label: string }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal h-9", !date && "text-muted-foreground")}>
          <CalendarIcon className="h-3.5 w-3.5 me-2" />
          {format(date, 'dd/MM/yyyy')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={(d) => d && onSelect(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-6">
      {/* Date Range Filter + Export */}
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker date={startDate} onSelect={setStartDate} label="From" />
        <span className="text-muted-foreground text-sm">→</span>
        <DatePicker date={endDate} onSelect={setEndDate} label="To" />
        <div className="flex-1" />
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={exportRevenue}><Download className="h-3.5 w-3.5 me-1" />{t('kpi.exportRevenue', { defaultValue: 'Revenue' })}</Button>
          <Button variant="outline" size="sm" onClick={exportLeads}><Download className="h-3.5 w-3.5 me-1" />{t('kpi.exportLeads', { defaultValue: 'Leads' })}</Button>
          <Button variant="outline" size="sm" onClick={exportCases}><Download className="h-3.5 w-3.5 me-1" />{t('kpi.exportCases', { defaultValue: 'Cases' })}</Button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className={`${totalProfit >= 0 ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('kpi.netProfit')}</p>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{totalProfit} €</p>
            <p className="text-[10px] text-muted-foreground">{t('kpi.paidStudents', { count: paidCases.length })}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('kpi.revenue')}</p>
            <p className="text-2xl font-bold text-blue-700">{totalRevenue} €</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('kpi.expenses')}</p>
            <p className="text-2xl font-bold text-red-700">{totalCosts} €</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('kpi.profitPerStudent')}</p>
            <p className="text-2xl font-bold">{avgProfitPerStudent} €</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('kpi.revenueTrend', { defaultValue: 'Revenue Trend' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stackId="1" stroke="hsl(220, 70%, 55%)" fill="hsl(220, 70%, 55%, 0.3)" name={t('kpi.revenue')} />
              <Area type="monotone" dataKey="profit" stackId="2" stroke="hsl(140, 55%, 45%)" fill="hsl(140, 55%, 45%, 0.3)" name={t('kpi.netProfit')} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t('kpi.conversionFunnel', { defaultValue: 'Conversion Funnel' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {funnelData.map((_, i) => (
                  <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Agent Comparison Chart */}
      {agentData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('kpi.agentPerformance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="leads" fill="hsl(220, 70%, 55%)" name={t('kpi.clients')} radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" fill="hsl(140, 55%, 45%)" name={t('kpi.paidLabel', { defaultValue: 'Paid' })} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Team Member Performance Cards */}
      {teamMemberData.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Users className="h-5 w-5" />{t('kpi.teamPerformance')}</h2>
          <div className="grid gap-3">
            {teamMemberData.map(l => (
              <Card key={l.id}><CardContent className="p-4">
                <h3 className="font-semibold mb-2">{l.full_name}</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center p-2 bg-muted/40 rounded"><p className="text-xs text-muted-foreground">{t('kpi.closeRate')}</p><p className="font-bold">{l.closeRate}%</p></div>
                  <div className="text-center p-2 bg-muted/40 rounded"><p className="text-xs text-muted-foreground">{t('kpi.closedCases')}</p><p className="font-bold">{l.closed}/{l.total}</p></div>
                  <div className="text-center p-2 bg-muted/40 rounded"><p className="text-xs text-muted-foreground">{t('kpi.revenue')}</p><p className="font-bold">{l.revenue} €</p></div>
                </div>
              </CardContent></Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIAnalytics;
