import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, ClipboardCheck, CheckCircle2, Activity, RefreshCw, Clock } from 'lucide-react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useNavigate } from 'react-router-dom';
import { isActiveStatus } from '@/lib/caseStatus';
import { isSlaBreached } from '@/lib/slaPolicy';
import { toneClasses } from '@/lib/statusTokens';

interface CaseCounts {
  total: number;
  submitted: number;
  enrollment_paid: number;
  forgotten: number;
  sla_breaches: number;
}

interface ActivityEntry {
  id: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  created_at: string;
}

interface QueueRow {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const AdminCommandCenter = () => {
  const { t, i18n } = useTranslation('dashboard');
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  // One parallel batch. The four queue queries do not depend on the three
  // summary queries, so they all fire together instead of in two waves.
  const fetchAll = useCallback(async () => {
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const [casesResult, activityResult, forgottenResult, reviewRes, unassignedRes, balanceRes, failRes] =
      await Promise.allSettled([
        supabase
          .from('cases')
          .select('status, last_activity_at, created_at')
          .is('deleted_at', null)
          .eq('archived', false),
        supabase
          .from('activity_log')
          .select('id, actor_name, action, entity_type, created_at')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.rpc('get_forgotten_cases'),
        supabase
          .from('cases')
          .select('id, full_name, case_reference, last_activity_at')
          .eq('status', 'submitted')
          .is('deleted_at', null)
          .order('last_activity_at')
          .limit(6),
        supabase
          .from('cases')
          .select('id, full_name, case_reference, created_at')
          .is('assigned_to', null)
          .is('deleted_at', null)
          .eq('archived', false)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('case_submissions')
          .select('id, case_id, remaining_balance, case:cases(full_name, case_reference)')
          .gt('remaining_balance', 0)
          .is('deleted_at', null)
          .order('remaining_balance', { ascending: false })
          .limit(6),
        supabase
          .from('auth_failure_log')
          .select('id, target, source, status_code, created_at')
          .gte('created_at', dayAgo)
          .order('created_at', { ascending: false })
          .limit(6),
      ]);

    const val = <T,>(r: PromiseSettledResult<{ data: T[] | null; error: unknown }>): T[] =>
      r.status === 'fulfilled' && !r.value.error ? (r.value.data ?? []) : [];

    const failed = (r: PromiseSettledResult<{ error: unknown }>): boolean =>
      r.status === 'rejected' ? true : Boolean(r.value.error);

    const cases = val<any>(casesResult as PromiseSettledResult<{ data: any[] | null; error: unknown }>);
    const activityData = val<ActivityEntry>(activityResult as PromiseSettledResult<{ data: ActivityEntry[] | null; error: unknown }>);
    const forgottenData = val<any>(forgottenResult as PromiseSettledResult<{ data: any[] | null; error: unknown }>);

    // SLA breach detection — central policy, not page-local thresholds
    const slaBreaches = cases.filter((c) => isSlaBreached(c.status, c.last_activity_at));

    const shortDate = (iso: string) =>
      new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return {
      counts: {
        total: cases.filter((c) => isActiveStatus(c.status)).length || 0,
        submitted: cases.filter((c) => c.status === 'submitted').length || 0,
        enrollment_paid: cases.filter((c) => c.status === 'enrollment_paid').length || 0,
        forgotten: forgottenData.length || 0,
        sla_breaches: slaBreaches.length || 0,
      } as CaseCounts,
      activity: activityData,
      // Distinguish "failed to load" from "genuinely empty" so a DB error never
      // renders as an empty queue or a zeroed KPI.
      countsError: failed(casesResult as PromiseSettledResult<{ error: unknown }>) || failed(forgottenResult as PromiseSettledResult<{ error: unknown }>),
      activityError: failed(activityResult as PromiseSettledResult<{ error: unknown }>),
      queueErrors: {
        review: failed(reviewRes as PromiseSettledResult<{ error: unknown }>),
        unassigned: failed(unassignedRes as PromiseSettledResult<{ error: unknown }>),
        payments: failed(balanceRes as PromiseSettledResult<{ error: unknown }>),
        auth: failed(failRes as PromiseSettledResult<{ error: unknown }>),
      } as Record<string, boolean>,
      awaitingReview: val<any>(reviewRes as PromiseSettledResult<{ data: any[] | null; error: unknown }>).map((c) => ({
        id: c.id,
        title: c.full_name,
        subtitle: `${c.case_reference ?? c.id.slice(0, 8)} · ${shortDate(c.last_activity_at)}`,
        href: '/admin/submissions',
      })) as QueueRow[],
      unassigned: val<any>(unassignedRes as PromiseSettledResult<{ data: any[] | null; error: unknown }>).map((c) => ({
        id: c.id,
        title: c.full_name,
        subtitle: `${c.case_reference ?? c.id.slice(0, 8)} · ${shortDate(c.created_at)}`,
        href: `/admin/cases/${c.id}`,
      })) as QueueRow[],
      outstanding: val<any>(balanceRes as PromiseSettledResult<{ data: any[] | null; error: unknown }>).map((s) => ({
        id: s.id,
        title: s.case?.full_name ?? '—',
        subtitle: `₪${Number(s.remaining_balance).toLocaleString('en-US')}`,
        href: `/admin/cases/${s.case_id}`,
      })) as QueueRow[],
      authFailures: val<any>(failRes as PromiseSettledResult<{ data: any[] | null; error: unknown }>).map((f) => ({
        id: f.id,
        title: `${f.source} · ${f.target}`,
        subtitle: `${f.status_code ?? ''} ${new Date(f.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`.trim(),
        href: '/admin/settings',
      })) as QueueRow[],
    };
  }, []);

  // Cached across navigation so returning to the Command Center paints
  // instantly from cache instead of refetching seven queries.
  const { data, isPending, refetch } = useQuery({
    queryKey: ['admin', 'command-center'],
    queryFn: fetchAll,
    staleTime: 30_000,
  });

  const counts: CaseCounts = data?.counts ?? { total: 0, submitted: 0, enrollment_paid: 0, forgotten: 0, sla_breaches: 0 };
  const activity: ActivityEntry[] = data?.activity ?? [];
  const awaitingReview = data?.awaitingReview ?? [];
  const unassigned = data?.unassigned ?? [];
  const outstanding = data?.outstanding ?? [];
  const authFailures = data?.authFailures ?? [];
  const countsError = data?.countsError ?? false;
  const activityError = data?.activityError ?? false;
  const queueErrors = data?.queueErrors ?? {};
  const loading = isPending;

  const fetchData = useCallback(() => { void refetch(); }, [refetch]);

  useRealtimeSubscription('cases', fetchData, true);
  useRealtimeSubscription('activity_log', fetchData, true);


  const queues = [
    {
      key: 'review',
      title: t('admin.commandCenter.queueReview', 'Awaiting review'),
      empty: t('admin.commandCenter.queueReviewEmpty', 'Nothing waiting for review'),
      icon: ClipboardCheck,
      tone: toneClasses("submitted").text,
      href: '/admin/submissions',
      rows: awaitingReview,
    },
    {
      key: 'unassigned',
      title: t('admin.commandCenter.queueUnassigned', 'Unassigned cases'),
      empty: t('admin.commandCenter.queueUnassignedEmpty', 'Every case has an owner'),
      icon: Users,
      tone: 'text-primary',
      href: '/admin/pipeline',
      rows: unassigned,
    },
    {
      key: 'payments',
      title: t('admin.commandCenter.queuePayments', 'Outstanding balances'),
      empty: t('admin.commandCenter.queuePaymentsEmpty', 'No outstanding balances'),
      icon: Clock,
      tone: toneClasses("payment").text,
      href: '/admin/financials',
      rows: outstanding,
    },
    {
      key: 'auth',
      title: t('admin.commandCenter.queueAuth', 'Authorization failures (24h)'),
      empty: t('admin.commandCenter.queueAuthEmpty', 'No authorization failures'),
      icon: AlertTriangle,
      tone: 'text-destructive',
      href: '/admin/settings',
      rows: authFailures,
    },
  ];

  const kpis = [
    {
      label: t('admin.commandCenter.activeCases', 'Active Cases'),
      value: counts.total,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
      onClick: () => navigate('/admin/pipeline'),
    },
    {
      label: t('admin.commandCenter.submitted', 'Submitted'),
      value: counts.submitted,
      icon: ClipboardCheck,
      color: toneClasses("submitted").text,
      bg: toneClasses("submitted").tint,
      onClick: () => navigate('/admin/submissions'),
    },
    {
      label: t('admin.commandCenter.enrolled', 'Enrolled'),
      value: counts.enrollment_paid,
      icon: CheckCircle2,
      color: toneClasses("enrolled").text,
      bg: toneClasses("enrolled").tint,
      onClick: () => navigate('/admin/submissions'),
    },
    {
      label: t('admin.commandCenter.slaBreaches', 'SLA Breaches'),
      value: counts.sla_breaches,
      icon: Clock,
      color: counts.sla_breaches > 0 ? toneClasses("payment").text : 'text-muted-foreground',
      bg: counts.sla_breaches > 0 ? toneClasses("payment").tint : 'bg-muted',
      onClick: () => navigate('/admin/pipeline'),
    },
    {
      label: t('admin.commandCenter.forgotten', 'Forgotten Cases'),
      value: counts.forgotten,
      icon: AlertTriangle,
      color: counts.forgotten > 0 ? 'text-destructive' : 'text-muted-foreground',
      bg: counts.forgotten > 0 ? 'bg-destructive/10' : 'bg-muted',
      onClick: () => navigate('/admin/pipeline'),
    },
  ];

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('admin.commandCenter.title', 'Command Center')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('admin.commandCenter.subtitle', 'Real-time overview of all activity')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('common.refresh', 'Refresh')}
        </Button>
      </div>

      {/* Forgotten Cases Alert */}
      {counts.forgotten > 0 && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5 cursor-pointer hover:bg-destructive/10 transition-colors neon-critical neon-danger"
          onClick={() => navigate('/admin/pipeline')}
        >
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive font-medium">
            {t('admin.commandCenter.forgottenAlert', '⚠️ {{count}} forgotten case(s) require attention', { count: counts.forgotten })}
          </p>
        </div>
      )}

      {/* SLA Breach Alert */}
      {counts.sla_breaches > 0 && (
        <div className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors neon-badge-important neon-warning ${toneClasses("payment").tint} border-[hsl(var(--status-payment)/0.3)] hover:bg-[hsl(var(--status-payment)/0.12)]`} onClick={() => navigate('/admin/pipeline')}>
          <Clock className={`h-5 w-5 shrink-0 ${toneClasses("payment").text}`} />
          <p className={`text-sm font-medium ${toneClasses("payment").text}`}>
            {t('admin.commandCenter.slaAlert', '⏱️ {{count}} case(s) have breached SLA thresholds', { count: counts.sla_breaches })}
          </p>
        </div>
      )}

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className="cursor-pointer hover:shadow-md transition-shadow border border-border"
            onClick={kpi.onClick}
          >
            <CardContent className="p-5">
              <div className={`inline-flex p-2 rounded-lg ${kpi.bg} mb-3`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              {loading ? (
                <div className="h-8 w-16 bg-muted rounded animate-pulse mb-1" />
              ) : (
                <p className={`text-3xl font-bold text-foreground ${kpi.value ? 'neon-kpi neon-primary' : ''}`}>{countsError ? '—' : kpi.value ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            {t('admin.commandCenter.recentActivity', 'Recent Activity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityError ? (
            <p className="text-sm text-destructive text-center py-8">
              {t('admin.commandCenter.activityLoadError', 'Unable to load recent activity')}
            </p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('admin.commandCenter.noActivity', 'No recent activity')}
            </p>
          ) : (
            <div className="space-y-3">
              {activity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{entry.actor_name || t('admin.commandCenter.system', 'System')}</span>
                      {' — '}
                      <span className="text-muted-foreground">{entry.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatTime(entry.created_at)}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{entry.entity_type}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action queues */}
      <div className="grid gap-4 lg:grid-cols-2">
        {queues.map((q) => (
          <Card key={q.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <q.icon className={`h-4 w-4 ${q.tone}`} />
                {q.title}
                <Badge variant="secondary">{q.rows.length}</Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate(q.href)}>
                {t('admin.commandCenter.viewAll', 'View all')}
              </Button>
            </CardHeader>
            <CardContent>
              {q.rows.length === 0 ? (
                queueErrors[q.key] ? (
                  <p className="text-sm text-destructive text-center py-6">
                    {t('admin.commandCenter.queueLoadError', 'Unable to load')}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">{q.empty}</p>
                )
              ) : (
                <div className="divide-y">
                  {q.rows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.title}</p>
                        <p className="truncate text-xs text-muted-foreground" dir="ltr">
                          {row.subtitle}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(row.href)}>
                        {t('admin.commandCenter.open', 'Open')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
};

export default AdminCommandCenter;
