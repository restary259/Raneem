import React, { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, ClipboardCheck, CheckCircle2, Activity, RefreshCw, Clock, Banknote, Landmark } from 'lucide-react';
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

interface AttributionIssue {
  issue_type: string;
  case_id: string;
  full_name: string | null;
  source: string | null;
  confidence: string;
  cluster_size: number | null;
}

interface CashCollectionRow {
  payment_id: string;
  case_id: string;
  case_reference: string | null;
  student_name: string | null;
  team_member_id: string | null;
  team_member_name: string | null;
  amount: number | null;
  collected_at: string | null;
}

const AdminCommandCenter = () => {
  const { t, i18n } = useTranslation('dashboard');
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();
  const [settlingCaseId, setSettlingCaseId] = useState<string | null>(null);

  // One parallel batch. The four queue queries do not depend on the three
  // summary queries, so they all fire together instead of in two waves.
  const fetchAll = useCallback(async () => {
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const [casesResult, activityResult, forgottenResult, reviewRes, unassignedRes, failRes, attributionRes] =
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
          .from('auth_failure_log')
          .select('id, target, source, status_code, created_at')
          .gte('created_at', dayAgo)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .rpc('list_attribution_integrity_issues')
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
        auth: failed(failRes as PromiseSettledResult<{ error: unknown }>),
        attribution: failed(attributionRes as PromiseSettledResult<{ error: unknown }>),
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
      authFailures: val<any>(failRes as PromiseSettledResult<{ data: any[] | null; error: unknown }>).map((f) => ({
        id: f.id,
        title: `${f.source} · ${f.target}`,
        subtitle: `${f.status_code ?? ''} ${new Date(f.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`.trim(),
        href: '/admin/settings?tab=security',
      })) as QueueRow[],
      attributionIssues: val<AttributionIssue>(attributionRes as PromiseSettledResult<{ data: AttributionIssue[] | null; error: unknown }>).map((issue) => ({
        id: `${issue.issue_type}-${issue.case_id}`,
        title: issue.full_name ?? '—',
        subtitle: issue.issue_type === 'duplicate_phone_cluster'
          ? `${issue.cluster_size ?? 0} rows · split attribution`
          : `${issue.confidence} · ${issue.source ?? 'unknown source'}`,
        href: `/admin/cases/${issue.case_id}`,
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

  // Cash Collection: every confirmed cash payment a team member has collected
  // but not yet handed over. Source of truth is the case_payments row itself
  // (via the get_admin_cash_collections RPC), so settling below updates this
  // list, the member drawer, and the team member's KPI in one write.
  const {
    data: cashCollections = [],
    isPending: cashLoading,
    isError: cashError,
    refetch: refetchCash,
  } = useQuery({
    queryKey: ['admin', 'cash-collections'],
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc('get_admin_cash_collections');
      if (error) throw error;
      return (rows ?? []) as CashCollectionRow[];
    },
    staleTime: 30_000,
  });

  const counts: CaseCounts = data?.counts ?? { total: 0, submitted: 0, enrollment_paid: 0, forgotten: 0, sla_breaches: 0 };
  const activity: ActivityEntry[] = data?.activity ?? [];
  const awaitingReview = data?.awaitingReview ?? [];
  const unassigned = data?.unassigned ?? [];
  const authFailures = data?.authFailures ?? [];
  const attributionIssues = data?.attributionIssues ?? [];
  const countsError = data?.countsError ?? false;
  const activityError = data?.activityError ?? false;
  const queueErrors = data?.queueErrors ?? {};
  const loading = isPending;

  const fetchData = useCallback(() => { void refetch(); }, [refetch]);
  const fetchCash = useCallback(() => { void refetchCash(); }, [refetchCash]);

  useRealtimeSubscription('cases', fetchData, true);
  useRealtimeSubscription('activity_log', fetchData, true);
  useRealtimeSubscription('case_payments', fetchCash, true);

  const cashTotal = cashCollections.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  const handleSettle = async (caseId: string) => {
    setSettlingCaseId(caseId);
    try {
      const { error } = await supabase.rpc('settle_cash_collection', { p_case_id: caseId });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['admin', 'cash-collections'] });
    } catch (err) {
      console.error('Failed to settle cash collection:', err);
    } finally {
      setSettlingCaseId(null);
    }
  };


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
      key: 'auth',
      title: t('admin.commandCenter.queueAuth', 'Authorization failures (24h)'),
      empty: t('admin.commandCenter.queueAuthEmpty', 'No authorization failures'),
      icon: AlertTriangle,
      tone: 'text-destructive',
      href: '/admin/settings?tab=security',
      rows: authFailures,
    },
    {
      key: 'attribution',
      title: t('admin.commandCenter.queueAttribution', 'Attribution integrity'),
      empty: t('admin.commandCenter.queueAttributionEmpty', 'No attribution issues detected'),
      icon: AlertTriangle,
      tone: toneClasses('payment').text,
      href: '/admin/pipeline',
      rows: attributionIssues,
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

      {/* Cash Collection — confirmed cash payments not yet handed to admin.
          Replaces the old "Outstanding balances" queue: one source of truth,
          oldest first, settle inline. */}
      <Card className="border-amber-500/40">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-4 w-4 text-amber-600" />
            {t('admin.commandCenter.cashCollection', 'Cash Collection')}
            <Badge variant="secondary">{cashCollections.length}</Badge>
          </CardTitle>
          {cashCollections.length > 0 && (
            <span className="text-sm font-semibold tabular-nums text-amber-700" dir="ltr">
              ₪{cashTotal.toLocaleString('en-US')}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {cashError ? (
            <p className="text-sm text-destructive text-center py-6">
              {t('admin.commandCenter.queueLoadError', 'Unable to load')}
            </p>
          ) : cashLoading ? (
            <div className="space-y-2">
              <div className="h-10 bg-muted rounded animate-pulse" />
              <div className="h-10 bg-muted rounded animate-pulse" />
            </div>
          ) : cashCollections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('admin.commandCenter.cashCollectionEmpty', 'No unsettled cash')}
            </p>
          ) : (
            <div className="divide-y">
              {cashCollections.map((row) => (
                <div key={row.payment_id} className="flex items-center justify-between gap-3 py-2.5 flex-wrap">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {row.student_name ?? '—'}
                      {row.case_reference && (
                        <span className="text-xs text-muted-foreground font-mono ms-2">{row.case_reference}</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t('admin.commandCenter.cashCollectedBy', 'Collected by {{name}}', {
                        name: row.team_member_name ?? t('admin.commandCenter.cashUnassigned', 'Unassigned'),
                      })}
                      {row.collected_at && ` · ${formatTime(row.collected_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums text-sm font-semibold" dir="ltr">
                      ₪{Number(row.amount ?? 0).toLocaleString('en-US')}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={settlingCaseId === row.case_id}
                      onClick={() => handleSettle(row.case_id)}
                    >
                      <Landmark className="h-3.5 w-3.5" />
                      {settlingCaseId === row.case_id
                        ? t('admin.members.settling', 'Settling…')
                        : t('admin.members.settle', 'Settle')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/cases/${row.case_id}`)}>
                      {t('admin.commandCenter.open', 'Open')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
