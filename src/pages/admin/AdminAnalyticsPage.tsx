import React, { useMemo, useCallback, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock } from 'lucide-react';
import { LoadingState, ErrorState } from '@/components/shell';

// Charts pull in the recharts vendor chunk. Deferring them keeps the KPI row
// as the first meaningful paint instead of waiting on chart parse/render.
const AnalyticsCharts = lazy(() => import('@/components/admin/AnalyticsCharts'));

const STATUSES = ['new', 'contacted', 'appointment_scheduled', 'profile_completion', 'payment_confirmed', 'submitted', 'enrollment_paid', 'forgotten', 'cancelled'];
const STATUS_COLORS = ['#6366f1', '#f59e0b', '#8b5cf6', '#f97316', '#14b8a6', '#3b82f6', '#22c55e', '#ef4444', '#94a3b8'];
const SOURCES = ['apply_page', 'manual', 'submit_new_student', 'social_media_partner'];


const AdminAnalyticsPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const isRtl = i18n.language === 'ar';

  interface CaseRow {
    status: string;
    source: string | null;
    created_at: string;
    last_activity_at: string;
  }

  // Cached under a stable key so switching Finance-hub tabs (Financials ↔
  // Spreadsheet ↔ Analytics) is served from cache instead of refetching.
  const { data: cases = [], isPending: loading, error: queryError, refetch } = useQuery<CaseRow[]>({
    queryKey: ['admin', 'analytics', 'cases'],
    queryFn: async () => {
      // Exclude archived cases so analytics reflect the active pipeline,
      // matching the universe shown on the Pipeline board and Command Center.
      const { data, error: fetchError } = await supabase
        .from('cases')
        .select('status, source, created_at, last_activity_at')
        .eq('archived', false);
      if (fetchError) throw fetchError;
      return (data ?? []) as CaseRow[];
    },
    staleTime: 60_000,
  });

  const error = queryError ? (queryError as Error).message : null;

  React.useEffect(() => {
    if (error) toast({ variant: 'destructive', description: error });
  }, [error, toast]);

  const refresh = useCallback(() => { void refetch(); }, [refetch]);


  const statusLabels: Record<string, string> = useMemo(() => ({
    new: t('admin.analytics.statusNew'),
    contacted: t('admin.analytics.statusContacted'),
    appointment_scheduled: t('admin.analytics.statusAppointment'),
    profile_completion: t('admin.analytics.statusProfile'),
    payment_confirmed: t('admin.analytics.statusPayment'),
    submitted: t('admin.analytics.statusSubmitted'),
    enrollment_paid: t('admin.analytics.statusEnrolled'),
    forgotten: t('admin.analytics.statusForgotten'),
    cancelled: t('admin.analytics.statusCancelled'),
  }), [t]);

  // One pass over the rows instead of a full .filter() scan per status/source.
  const { statusCounts, sourceCounts, stageMs, kpi } = useMemo(() => {
    const status: Record<string, number> = {};
    const source: Record<string, number> = {};
    const ms: Record<string, { sum: number; n: number }> = {};
    const now = Date.now();
    let enrolled = 0;
    let active = 0;
    for (const c of cases) {
      status[c.status] = (status[c.status] ?? 0) + 1;
      if (c.source) source[c.source] = (source[c.source] ?? 0) + 1;
      const slot = (ms[c.status] ??= { sum: 0, n: 0 });
      slot.sum += Math.max(0, now - new Date(c.last_activity_at).getTime());
      slot.n += 1;
      if (c.status === 'enrollment_paid') enrolled += 1;
      if (!['enrollment_paid', 'cancelled', 'forgotten'].includes(c.status)) active += 1;
    }
    return {
      statusCounts: status,
      sourceCounts: source,
      stageMs: ms,
      kpi: {
        total: cases.length,
        active,
        enrolled,
        conversion: cases.length ? Math.round((enrolled / cases.length) * 100) : 0,
      },
    };
  }, [cases]);

  const funnelData = useMemo(() => STATUSES.map((s, i) => ({
    name: statusLabels[s] || s,
    count: statusCounts[s] ?? 0,
    fill: STATUS_COLORS[i],
  })), [statusCounts, statusLabels]);

  const sourceData = useMemo(() => SOURCES.map(s => ({
    name: s === 'apply_page' ? t('admin.analytics.sourceApplyPage')
        : s === 'manual' ? t('admin.analytics.sourceManual')
        : s === 'submit_new_student' ? t('admin.analytics.sourceDirect')
        : t('admin.analytics.sourcePartner'),
    count: sourceCounts[s] ?? 0,
  })).filter(s => s.count > 0), [sourceCounts, t]);

  // Avg days in current stage (time since last_activity_at as proxy for stage entry)
  const avgDays = useMemo(() => STATUSES.slice(0, 7).map(s => {
    const slot = stageMs[s];
    if (!slot || slot.n === 0) return { name: statusLabels[s], avg: 0, hours: 0 };
    const avgMs = slot.sum / slot.n;
    return {
      name: statusLabels[s],
      avg: Math.round((avgMs / 86400000) * 10) / 10,
      hours: Math.round(avgMs / 3600000),
    };
  }), [stageMs, statusLabels]);


  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('admin.analytics.title')}</h1>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading && cases.length === 0 && <LoadingState variant="kpi" rows={4} />}
      {error && !loading && (
        <ErrorState title={t('admin.analytics.loadFailed', 'Failed to load analytics')} description={error} onRetry={refresh} />
      )}

      {/* KPI summary */}
      {(!loading || cases.length > 0) && !error && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('admin.analytics.kpiTotalCases'), value: kpi.total },
          { label: t('admin.analytics.kpiActive'), value: kpi.active },
          { label: t('admin.analytics.kpiEnrolled'), value: kpi.enrolled },
          { label: t('admin.analytics.kpiConversion'), value: `${kpi.conversion}%` },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-4 min-h-[80px]">
              <p className="text-xs text-muted-foreground mb-1 line-clamp-2 leading-tight">{kpi.label}</p>
              <p className="text-xl font-bold truncate min-w-0">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      )}


      {(!loading || cases.length > 0) && !error && (
        <Suspense fallback={<LoadingState rows={3} />}>
          <AnalyticsCharts
            funnelData={funnelData}
            sourceData={sourceData}
            avgDays={avgDays}
            colors={STATUS_COLORS}
            isRtl={isRtl}
          />
        </Suspense>
      )}
    </div>
  );
};

export default AdminAnalyticsPage;
