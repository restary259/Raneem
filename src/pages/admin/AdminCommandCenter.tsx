import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, ClipboardCheck, CheckCircle2, RefreshCw, Clock, Banknote, Landmark } from 'lucide-react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useNavigate } from '@/lib/router-compat';
import { isActiveStatus } from '@/lib/caseStatus';
import { isSlaBreached } from '@/lib/slaPolicy';
import { toneClasses } from '@/lib/statusTokens';
import { ErrorState } from '@/components/shell';

interface CaseCounts {
  total: number;
  submitted: number;
  enrollment_paid: number;
  forgotten: number;
  sla_breaches: number;
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

/**
 * One successful read of the Command Center. A queue is `null` when its query
 * failed — the component then reuses the previous snapshot's rows rather than
 * rendering a fabricated empty queue.
 */
interface CommandCenterSnapshot {
  counts: CaseCounts;
  awaitingReview: QueueRow[] | null;
  unassigned: QueueRow[] | null;
  authFailures: QueueRow[] | null;
  attributionIssues: QueueRow[] | null;
  queueErrors: Record<string, boolean>;
}

const AdminCommandCenter = () => {
  const { t, i18n } = useTranslation('dashboard');
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();
  const [settlingCaseId, setSettlingCaseId] = useState<string | null>(null);
  const [referralQueue, setReferralQueue] = useState<Array<{ id: string; case_id: string; student_name: string; case_reference: string | null; payment_status: string; referrer_name: string | null }>>([]);
  const [referralQueueLoading, setReferralQueueLoading] = useState(true);

  // One parallel batch. The four queue queries do not depend on the three
  // summary queries, so they all fire together instead of in two waves.
  const fetchAll = useCallback(async () => {
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const [casesResult, forgottenResult, reviewRes, unassignedRes, failRes, attributionRes] =
      await Promise.allSettled([
        supabase
          .from('cases')
          .select('status, last_activity_at, created_at')
          .is('deleted_at', null)
          .eq('archived', false),
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

    // A failed query MUST NOT be laundered into an empty result. Silently
    // turning `{ data: null, error }` into `[]` made a transient background
    // refetch (fired by the realtime subscription after any case action) look
    // like a successful read of an empty table, so React Query replaced the
    // last known-good cache with fabricated zeros and the admin had to relaunch
    // the app to get real numbers back. Throwing instead keeps the previous
    // successful data on screen (React Query v5 retains `data` and sets
    // `status: 'error'` when a refetch rejects) and lets the retry heal it.
    const unwrap = <T,>(r: PromiseSettledResult<{ data: T | null; error: unknown }>): T => {
      if (r.status === 'rejected') throw r.reason;
      if (r.value.error) throw r.value.error;
      return r.value.data as T;
    };

    // The KPI tiles are all-or-nothing: a zeroed count is indistinguishable from
    // "this is really 0", so `cases` and `forgotten` failing aborts the whole
    // snapshot rather than reporting partial (and therefore wrong) numbers.
    const cases = unwrap<any[]>(casesResult as PromiseSettledResult<{ data: any[] | null; error: unknown }>) ?? [];
    const forgottenData = unwrap<any[]>(forgottenResult as PromiseSettledResult<{ data: any[] | null; error: unknown }>) ?? [];

    // The four action queues are independent surfaces. One queue failing must
    // not blank the whole Command Center, so each failure is recorded per-queue
    // and its rows fall back to the previous snapshot (see the component).
    const queueRows = <T,>(
      r: PromiseSettledResult<{ data: T[] | null; error: unknown }>,
      map: (row: T) => QueueRow,
    ): { rows: QueueRow[] | null; error: boolean } => {
      if (r.status === 'rejected' || r.value.error) return { rows: null, error: true };
      return { rows: (r.value.data ?? []).map(map), error: false };
    };

    // SLA breach detection — central policy, not page-local thresholds
    const slaBreaches = cases.filter((c) => isSlaBreached(c.status, c.last_activity_at));

    const shortDate = (iso: string) =>
      new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const review = queueRows<any>(reviewRes as PromiseSettledResult<{ data: any[] | null; error: unknown }>, (c) => ({
      id: c.id,
      title: c.full_name,
      subtitle: `${c.case_reference ?? c.id.slice(0, 8)} · ${shortDate(c.last_activity_at)}`,
      href: '/admin/submissions',
    }));
    const unassigned = queueRows<any>(unassignedRes as PromiseSettledResult<{ data: any[] | null; error: unknown }>, (c) => ({
      id: c.id,
      title: c.full_name,
      subtitle: `${c.case_reference ?? c.id.slice(0, 8)} · ${shortDate(c.created_at)}`,
      href: `/admin/cases/${c.id}`,
    }));
    const auth = queueRows<any>(failRes as PromiseSettledResult<{ data: any[] | null; error: unknown }>, (f) => ({
      id: f.id,
      title: `${f.source} · ${f.target}`,
      subtitle: `${f.status_code ?? ''} ${new Date(f.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`.trim(),
      href: '/admin/settings?tab=security',
    }));
    const attribution = queueRows<AttributionIssue>(attributionRes as PromiseSettledResult<{ data: AttributionIssue[] | null; error: unknown }>, (issue) => ({
      id: `${issue.issue_type}-${issue.case_id}`,
      title: issue.full_name ?? '—',
      subtitle: issue.issue_type === 'duplicate_phone_cluster'
        ? `${issue.cluster_size ?? 0} rows · split attribution`
        : `${issue.confidence} · ${issue.source ?? 'unknown source'}`,
      href: `/admin/cases/${issue.case_id}`,
    }));

    return {
      counts: {
        total: cases.filter((c) => isActiveStatus(c.status)).length || 0,
        submitted: cases.filter((c) => c.status === 'submitted').length || 0,
        enrollment_paid: cases.filter((c) => c.status === 'enrollment_paid').length || 0,
        forgotten: forgottenData.length || 0,
        sla_breaches: slaBreaches.length || 0,
      } as CaseCounts,
      // `null` means "this queue could not be read" — distinct from `[]`, which
      // means "read successfully, genuinely empty".
      awaitingReview: review.rows,
      unassigned: unassigned.rows,
      authFailures: auth.rows,
      attributionIssues: attribution.rows,
      queueErrors: {
        review: review.error,
        unassigned: unassigned.error,
        auth: auth.error,
        attribution: attribution.error,
      } as Record<string, boolean>,
    } satisfies CommandCenterSnapshot;
  }, []);

  // Cached across navigation so returning to the Command Center paints
  // instantly from cache instead of refetching seven queries.
  //
  // `retry` is deliberately NOT configured here: the global default in
  // src/router.tsx (3 attempts with exponential backoff, permanent errors never
  // retried) already covers the transient Supabase failures that used to be
  // laundered into zeros. Until that retry succeeds the query stays in the error
  // state, and React Query keeps the last successful `data` on screen.
  const { data, isPending, isError, isFetching, refetch } = useQuery<CommandCenterSnapshot>({
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

  // The query-level failure is the ONLY situation where counts fall back to
  // zeros, and it is reachable only before the first successful load — after
  // that React Query keeps the previous `data`. That first-load case renders an
  // explicit error with a retry instead of a wall of zeros, so a failed read is
  // never presented as "the numbers really are 0".
  const loadFailed = isError && data === undefined;

  // A queue whose own query failed is `null` in the snapshot. Keep the last
  // known-good rows for EACH queue separately so a transient failure cannot make
  // a populated queue look empty; a genuine `[]` is still rendered as empty.
  //
  // Per-queue (not a single whole-snapshot ref) is load-bearing: the failed
  // snapshot is itself cached by React Query, so a whole-snapshot ref would be
  // overwritten with `null` for the failed queue and the rows would vanish on
  // the next unrelated render. Only a successful `[]` clears a queue.
  const lastGoodQueues = useRef<Record<string, QueueRow[]>>({});
  const queueRowsFor = (key: keyof CommandCenterSnapshot) => {
    const rows = data?.[key] as QueueRow[] | null | undefined;
    if (rows) lastGoodQueues.current[key as string] = rows;
    return rows ?? lastGoodQueues.current[key as string] ?? [];
  };

  const awaitingReview = queueRowsFor('awaitingReview');
  const unassigned = queueRowsFor('unassigned');
  const authFailures = queueRowsFor('authFailures');
  const attributionIssues = queueRowsFor('attributionIssues');
  // `null` in the snapshot means the queue could not be read — distinct from an
  // empty `[]`. Derive from the snapshot rather than from the rendered rows, so
  // retained rows are still reported as stale below.
  const queueFailed = (key: keyof CommandCenterSnapshot) => data?.[key] === null;
  const queueErrors: Record<string, boolean> = {
    review: queueFailed('awaitingReview'),
    unassigned: queueFailed('unassigned'),
    auth: queueFailed('authFailures'),
    attribution: queueFailed('attributionIssues'),
  };
  const loading = isPending;

  // A background refetch that failed while the real numbers are still on screen:
  // keep the data, but say so instead of silently showing stale values.
  const staleError = isError && data !== undefined;

  const fetchData = useCallback(() => { void refetch(); }, [refetch]);

  const fetchReferralQueue = useCallback(async () => {
    setReferralQueueLoading(true);
    try {
      // case_reference lives on `cases`, not on the invoice row — join it in,
      // otherwise the query errors and the queue silently renders empty.
      const { data, error } = await (supabase as any)
        .from('case_registration_invoices')
        .select('id,case_id,student_name,payment_status,referrer_name,issued_at,cases(case_reference)')
        .neq('payment_status', 'paid')
        .order('issued_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      setReferralQueue(((data ?? []) as Array<any>).map((row) => ({
        id: row.id,
        case_id: row.case_id,
        student_name: row.student_name,
        payment_status: row.payment_status,
        referrer_name: row.referrer_name,
        case_reference: row.cases?.case_reference ?? null,
      })));
    } catch (error) {
      console.error('[CommandCenter] referral registration queue failed:', error);
      setReferralQueue([]);
    } finally {
      setReferralQueueLoading(false);
    }
  }, []);


  const fetchCash = useCallback(() => { void refetchCash(); }, [refetchCash]);

  useRealtimeSubscription('cases', fetchData, true);
  useRealtimeSubscription('case_payments', fetchCash, true);
  useRealtimeSubscription('case_registration_invoices', fetchReferralQueue, true);
  useEffect(() => { void fetchReferralQueue(); }, [fetchReferralQueue]);

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

  // Nothing has ever loaded: rendering the tiles would mean showing fabricated
  // zeros, so replace the whole body with an explicit error and a retry. Once a
  // successful snapshot exists, React Query keeps it and the background-failure
  // banner below is used instead.
  if (loadFailed) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{t('admin.commandCenter.title', 'Command Center')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('admin.commandCenter.subtitle', 'Real-time overview of all activity')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {t('common.refresh', 'Refresh')}
          </Button>
        </div>

        <ErrorState
          title={t('admin.commandCenter.loadFailed', 'Unable to load the Command Center')}
          description={t(
            'admin.commandCenter.loadFailedBody',
            'The overview could not be read. Your data is safe — retry to load it.',
          )}
          onRetry={fetchData}
          retryLabel={t('common.retry', 'Retry')}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{t('admin.commandCenter.title', 'Command Center')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('admin.commandCenter.subtitle', 'Real-time overview of all activity')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isFetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {t('common.refresh', 'Refresh')}
        </Button>
      </div>

      {/* Background refetch failed but real numbers are still on screen. Say
          so rather than silently presenting stale values (never zero them). */}
      {staleError && (
        <div
          className="flex flex-wrap items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive font-medium min-w-0 flex-1">
            {t(
              'admin.commandCenter.refreshFailed',
              'Could not refresh — showing the last data that loaded successfully.',
            )}
          </p>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isFetching} className="shrink-0">
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      )}

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
                <p className={`text-3xl font-bold text-foreground ${kpi.value ? 'neon-kpi neon-primary' : ''}`}>{kpi.value ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1 break-words">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cash Collection — confirmed cash payments not yet handed to admin.
          Replaces the old "Outstanding balances" queue: one source of truth,
          oldest first, settle inline. */}
      <Card className="min-w-0 border-amber-500/40">
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
                  <div className="min-w-0 flex-1">
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

      {/* Referral registrations — operational queue, while the case remains the master record. */}
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="text-base flex min-w-0 items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span>{t('admin.commandCenter.referralRegistrations', 'Referral registrations')}</span>
            <Badge variant="secondary">{referralQueue.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/referrals')}>
            {t('admin.commandCenter.viewAll', 'View all')}
          </Button>
        </CardHeader>
        <CardContent>
          {referralQueueLoading ? (
            <div className="space-y-2">
              <div className="h-10 rounded bg-muted animate-pulse" />
              <div className="h-10 rounded bg-muted animate-pulse" />
            </div>
          ) : referralQueue.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('admin.commandCenter.referralRegistrationsEmpty', 'No unpaid referral registrations')}
            </p>
          ) : (
            <div className="divide-y">
              {referralQueue.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 py-3 text-start hover:bg-muted/30"
                  onClick={() => navigate(`/admin/cases/${row.case_id}`)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.student_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.case_reference ?? '—'}{row.referrer_name ? ` · ${t('admin.commandCenter.referredBy', 'Referred by')} ${row.referrer_name}` : ''}
                    </p>
                  </div>
                  <Badge variant={row.payment_status === 'submitted' ? 'secondary' : 'outline'}>
                    {row.payment_status === 'submitted'
                      ? t('admin.commandCenter.transferSubmitted', 'Transfer submitted')
                      : t('admin.commandCenter.awaitingPayment', 'Awaiting payment')}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action queues */}
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {queues.map((q) => (
          <Card key={q.key} className="min-w-0 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-base flex min-w-0 flex-wrap items-center gap-2">
                <q.icon className={`h-4 w-4 shrink-0 ${q.tone}`} />
                <span className="min-w-0 break-words">{q.title}</span>
                <Badge variant="secondary" className="shrink-0">{q.rows.length}</Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate(q.href)}>
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
                  {/* Rows are retained from the last successful read. Say so —
                      otherwise outdated action/auth rows look current. */}
                  {queueErrors[q.key] && (
                    <p className="flex items-center gap-2 py-2 text-xs text-destructive" role="alert">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0">
                        {t('admin.commandCenter.queueStale', 'Could not refresh — showing the last loaded list.')}
                      </span>
                    </p>
                  )}
                  {q.rows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={row.title}>{row.title}</p>
                        <p className="truncate text-xs text-muted-foreground" dir="ltr" title={row.subtitle}>
                          {row.subtitle}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate(row.href)}>
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
