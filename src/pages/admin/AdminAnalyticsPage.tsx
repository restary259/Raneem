import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { RefreshCw } from 'lucide-react';

const STATUSES = ['new', 'contacted', 'appointment_scheduled', 'profile_completion', 'payment_confirmed', 'submitted', 'enrollment_paid', 'forgotten', 'cancelled'];
const STATUS_COLORS = ['#6366f1', '#f59e0b', '#8b5cf6', '#f97316', '#14b8a6', '#3b82f6', '#22c55e', '#ef4444', '#94a3b8'];
const SOURCES = ['apply_page', 'manual', 'submit_new_student', 'social_media_partner'];

const AdminAnalyticsPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const isRtl = i18n.language === 'ar';

  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('cases').select('status, source, created_at, last_activity_at');
      if (error) throw error;
      setCases(data || []);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusLabels: Record<string, string> = {
    new: t('admin.analytics.statusNew'),
    contacted: t('admin.analytics.statusContacted'),
    appointment_scheduled: t('admin.analytics.statusAppointment'),
    profile_completion: t('admin.analytics.statusProfile'),
    payment_confirmed: t('admin.analytics.statusPayment'),
    submitted: t('admin.analytics.statusSubmitted'),
    enrollment_paid: t('admin.analytics.statusEnrolled'),
    forgotten: t('admin.analytics.statusForgotten'),
    cancelled: t('admin.analytics.statusCancelled'),
  };

  const funnelData = STATUSES.map((s, i) => ({
    name: statusLabels[s] || s,
    count: cases.filter(c => c.status === s).length,
    fill: STATUS_COLORS[i],
  }));

  const sourceData = SOURCES.map(s => ({
    name: s === 'apply_page' ? t('admin.analytics.sourceApplyPage')
        : s === 'manual' ? t('admin.analytics.sourceManual')
        : s === 'submit_new_student' ? t('admin.analytics.sourceDirect')
        : t('admin.analytics.sourcePartner'),
    count: cases.filter(c => c.source === s).length,
  })).filter(s => s.count > 0);

  // Avg days per stage
  const avgDays = STATUSES.slice(0, 7).map(s => {
    const group = cases.filter(c => c.status === s);
    if (group.length === 0) return { name: statusLabels[s], avg: 0 };
    const avg = group.reduce((sum, c) => {
      const diff = (new Date(c.last_activity_at).getTime() - new Date(c.created_at).getTime()) / 86400000;
      return sum + Math.max(0, diff);
    }, 0) / group.length;
    return { name: statusLabels[s], avg: Math.round(avg) };
  });

  const yAxisWidth = isRtl ? 130 : 110;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('admin.analytics.title')}</h1>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('admin.analytics.kpiTotalCases'), value: cases.length },
          { label: t('admin.analytics.kpiActive'), value: cases.filter(c => !['enrollment_paid','cancelled','forgotten'].includes(c.status)).length },
          { label: t('admin.analytics.kpiEnrolled'), value: cases.filter(c => c.status === 'enrollment_paid').length },
          { label: t('admin.analytics.kpiConversion'), value: `${cases.length ? Math.round(cases.filter(c => c.status === 'enrollment_paid').length / cases.length * 100) : 0}%` },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-4 min-h-[80px]">
              <p className="text-xs text-muted-foreground mb-1 line-clamp-2 leading-tight">{kpi.label}</p>
              <p className="text-xl font-bold truncate min-w-0">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6" dir="ltr">
        {/* Funnel */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t('admin.analytics.conversionFunnel')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={500} style={{ overflow: 'visible' }}>
              <BarChart
                data={funnelData}
                layout="vertical"
                barCategoryGap="40%"
                barSize={20}
                margin={{ top: 4, bottom: 4, left: 0, right: 4 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={yAxisWidth}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  tickMargin={6}
                />
                <Tooltip
                  formatter={(v) => [v, t('admin.analytics.tooltipCases')]}
                  contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="count" radius={4} minPointSize={4}>
                  {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Source breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t('admin.analytics.sourceBreakdown')}</CardTitle></CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">{t('admin.analytics.noData')}</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={false}
                    >
                      {sourceData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v, name) => [v, name]}
                      contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
                  {sourceData.map((s, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }} />
                      {s.name}: <span className="font-medium text-foreground">{s.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Avg days per stage */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">{t('admin.analytics.avgDaysPerStage')}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={avgDays} margin={{ top: 4, bottom: 50, left: 0, right: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: isRtl ? 9 : 10, fill: 'currentColor' }}
                  angle={-35}
                  textAnchor="middle"
                  height={80}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} />
                <Tooltip
                  formatter={(v) => [`${v} ${t('admin.analytics.tooltipDays')}`, '']}
                  contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="avg" fill="hsl(var(--primary))" radius={4} minPointSize={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
