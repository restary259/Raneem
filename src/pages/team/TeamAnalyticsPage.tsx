import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { startOfMonth, endOfMonth } from 'date-fns';
import { TrendingUp, Users, Calendar } from 'lucide-react';

/* ── Chart colours — explicit HSL values for Recharts (no CSS var support in SVG) ── */
const CHART_COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(50, 100%, 50%)',
  'hsl(270, 80%, 65%)',
  'hsl(25, 95%, 55%)',
  'hsl(140, 60%, 45%)',
  'hsl(185, 90%, 45%)',
  'hsl(0, 85%, 60%)',
];

export default function TeamAnalyticsPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('dashboard');
  const isRtl = i18n.language === 'ar';

  const [caseCounts, setCaseCounts] = useState<Record<string, number>>({});
  const [closedThisMonth, setClosedThisMonth] = useState(0);
  const [todayAppts, setTodayAppts] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd   = endOfMonth(new Date()).toISOString();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [casesRes, closedRes, apptRes] = await Promise.all([
      supabase.from('cases').select('status').eq('assigned_to', user.id),
      supabase.from('cases').select('id')
        .eq('assigned_to', user.id)
        .in('status', ['submitted', 'enrollment_paid'])
        .gte('updated_at', monthStart)
        .lte('updated_at', monthEnd),
      supabase.from('appointments').select('id')
        .eq('team_member_id', user.id)
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString()),
    ]);

    const counts: Record<string, number> = {};
    for (const c of casesRes.data ?? []) counts[c.status] = (counts[c.status] ?? 0) + 1;
    setCaseCounts(counts);
    setClosedThisMonth(closedRes.data?.length ?? 0);
    setTodayAppts(apptRes.data?.length ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Translate status keys for chart labels */
  const chartData = Object.entries(caseCounts).map(([status, count]) => ({
    status,
    label: t(`lawyer.statuses.${status}`, status.replace(/_/g, ' ')),
    count,
  }));

  const totalCases = Object.values(caseCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold text-foreground">
        {t('lawyer.analytics.pageTitle', t('lawyer.tabs.analytics', 'Analytics'))}
      </h1>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">{t('lawyer.analytics.closedThisMonth')}</span>
            </div>
            <div className="text-3xl font-bold tabular-nums">{closedThisMonth}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">{t('lawyer.analytics.totalCases')}</span>
            </div>
            <div className="text-3xl font-bold tabular-nums">{totalCases}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">{t('lawyer.kpi.todayAppts')}</span>
            </div>
            <div className="text-3xl font-bold tabular-nums">{todayAppts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Cases by status chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('lawyer.analytics.casesByStatus')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              {t('lawyer.analytics.loading')}
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              {t('lawyer.analytics.noData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={chartData}
                layout="horizontal"
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  width={isRtl ? 120 : 32}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value: number) => [value, t('lawyer.analytics.caseCount')]}
                  labelFormatter={(label: string) => label}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
