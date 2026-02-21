import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Clock, AlertTriangle, CheckCircle2, DollarSign, Users, CalendarClock, Filter } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const LOCK_DAYS = 20;
const MS_PER_DAY = 86_400_000;

type FilterType = 'all' | 'ready' | 'overdue' | 'due7' | 'pending';

interface Props {
  cases: any[];
  leads: any[];
  influencers: any[];
  rewards: any[];
  payoutRequests: any[];
  onRefresh: () => void;
}

/* ---------- helpers ---------- */

function getDueInfo(paidAt: string | null) {
  if (!paidAt) return null;
  const paid = new Date(paidAt).getTime();
  const due = paid + LOCK_DAYS * MS_PER_DAY;
  const remaining = Math.ceil((due - Date.now()) / MS_PER_DAY);
  return { dueDate: new Date(due), remaining };
}

function fmtDate(d: Date | string | null) {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(n: number) {
  return `₪${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

/* ---------- dot badge ---------- */
const DotBadge = ({ color, children }: { color: string; children: React.ReactNode }) => {
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-400',
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
  };
  const bgMap: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    emerald: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    red: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300',
    blue: 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bgMap[color] || ''}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colorMap[color] || ''}`} />
      {children}
    </span>
  );
};

/* ---------- component ---------- */

const InfluencerPayoutsTab: React.FC<Props> = ({ cases, leads, influencers, rewards, payoutRequests }) => {
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'due' | 'amount'>('due');

  /* Build per-influencer aggregation */
  const { rows, summary, filterCounts } = useMemo(() => {
    const leadMap = new Map(leads.map((l: any) => [l.id, l]));
    const paidCases = cases.filter((c: any) => c.case_status === 'paid' && !c.deleted_at);

    const infCaseMap = new Map<string, any[]>();
    for (const cs of paidCases) {
      const lead = leadMap.get(cs.lead_id);
      if (!lead || lead.source_type !== 'influencer' || !lead.source_id) continue;
      const infId = lead.source_id;
      if (!infCaseMap.has(infId)) infCaseMap.set(infId, []);
      infCaseMap.get(infId)!.push({ ...cs, _lead: lead });
    }

    const infRewardMap = new Map<string, any[]>();
    for (const r of rewards) {
      if (!infRewardMap.has(r.user_id)) infRewardMap.set(r.user_id, []);
      infRewardMap.get(r.user_id)!.push(r);
    }

    const prMap = new Map<string, any[]>();
    for (const pr of payoutRequests) {
      if (!prMap.has(pr.requestor_id)) prMap.set(pr.requestor_id, []);
      prMap.get(pr.requestor_id)!.push(pr);
    }

    let totalPending = 0;
    let dueThisWeek = 0;
    let overdueCount = 0;
    let totalPaidOut = 0;

    const rows = influencers.map((inf: any) => {
      const infCases = infCaseMap.get(inf.id) || [];
      const infLeads = leads.filter((l: any) => l.source_id === inf.id);
      const infRewards = infRewardMap.get(inf.id) || [];
      const infPayouts = prMap.get(inf.id) || [];

      let pendingCountdown = 0;
      let readyForPayout = 0;
      let overdueLocal = 0;
      let totalOwed = 0;
      let nextDueDate: Date | null = null;

      const caseDetails = infCases.map((cs: any) => {
        const due = getDueInfo(cs.paid_countdown_started_at);
        const commission = Number(cs.influencer_commission) || 0;
        const matchingReward = infRewards.find((r: any) => r.admin_notes?.includes(cs.id));
        const rewardStatus = matchingReward?.status || 'pending';

        let paymentStatus: 'countdown' | 'ready' | 'overdue' | 'paid' = 'countdown';

        if (rewardStatus === 'paid') {
          paymentStatus = 'paid';
        } else if (!due) {
          paymentStatus = 'ready';
        } else if (due.remaining > 0) {
          paymentStatus = 'countdown';
          pendingCountdown++;
          if (due.remaining <= 7) dueThisWeek++;
          if (!nextDueDate || due.dueDate < nextDueDate) nextDueDate = due.dueDate;
        } else {
          if (rewardStatus === 'pending' || rewardStatus === 'approved') {
            if (due.remaining <= -7) {
              paymentStatus = 'overdue';
              overdueLocal++;
              overdueCount++;
            } else {
              paymentStatus = 'ready';
              readyForPayout++;
            }
          }
        }

        if (rewardStatus !== 'paid' && commission > 0) {
          totalOwed += commission;
          totalPending += commission;
        }

        return {
          caseId: cs.id,
          studentName: cs.student_full_name || cs._lead?.full_name || '—',
          paidAt: cs.paid_countdown_started_at,
          dueDate: due?.dueDate || null,
          daysRemaining: due?.remaining ?? 0,
          commission,
          paymentStatus,
          rewardStatus,
        };
      });

      const paidTotal = infPayouts
        .filter((pr: any) => pr.status === 'paid')
        .reduce((s: number, pr: any) => s + (Number(pr.amount) || 0), 0);
      totalPaidOut += paidTotal;

      let status: 'green' | 'yellow' | 'red' = 'green';
      if (overdueLocal > 0) status = 'red';
      else if (pendingCountdown > 0 || readyForPayout > 0) status = 'yellow';

      return {
        id: inf.id,
        name: inf.full_name || inf.email,
        totalReferred: infLeads.length,
        paidStudents: infCases.length,
        pendingCountdown,
        readyForPayout,
        overdue: overdueLocal,
        totalOwed,
        totalPaid: paidTotal,
        nextDueDate,
        status,
        caseDetails,
      };
    }).filter((r: any) => r.paidStudents > 0 || r.totalReferred > 0);

    // Pre-compute filter counts
    const filterCounts = {
      all: rows.length,
      ready: rows.filter(r => r.readyForPayout > 0).length,
      overdue: rows.filter(r => r.overdue > 0).length,
      due7: rows.filter(r => r.caseDetails.some((c: any) => c.paymentStatus === 'countdown' && c.daysRemaining <= 7 && c.daysRemaining > 0)).length,
      pending: rows.filter(r => r.pendingCountdown > 0 || r.readyForPayout > 0 || r.overdue > 0).length,
    };

    return { rows, summary: { totalPending, dueThisWeek, overdueCount, totalPaidOut }, filterCounts };
  }, [cases, leads, influencers, rewards, payoutRequests]);

  /* Filter rows */
  const filtered = useMemo(() => {
    let result = rows;
    switch (filter) {
      case 'ready': result = rows.filter(r => r.readyForPayout > 0); break;
      case 'overdue': result = rows.filter(r => r.overdue > 0); break;
      case 'due7': result = rows.filter(r => r.caseDetails.some((c: any) => c.paymentStatus === 'countdown' && c.daysRemaining <= 7 && c.daysRemaining > 0)); break;
      case 'pending': result = rows.filter(r => r.pendingCountdown > 0 || r.readyForPayout > 0 || r.overdue > 0); break;
    }
    return [...result].sort((a, b) => {
      if (sortBy === 'amount') return b.totalOwed - a.totalOwed;
      const aD = a.nextDueDate?.getTime() ?? Infinity;
      const bD = b.nextDueDate?.getTime() ?? Infinity;
      return aD - bD;
    });
  }, [rows, filter, sortBy]);

  const filterButtons: { key: FilterType; label: string; dot?: string }[] = [
    { key: 'all', label: t('admin.influencerPayouts.allPending', 'All') },
    { key: 'ready', label: t('admin.influencerPayouts.readyForPayout', 'Ready'), dot: 'bg-emerald-500' },
    { key: 'overdue', label: t('admin.influencerPayouts.overdueFilter', 'Overdue'), dot: 'bg-red-500' },
    { key: 'due7', label: t('admin.influencerPayouts.dueIn7Days', 'Due 7d'), dot: 'bg-blue-500' },
    { key: 'pending', label: t('admin.influencerPayouts.countdownActive', 'Pending'), dot: 'bg-amber-500' },
  ];

  const statusBadge = (status: 'green' | 'yellow' | 'red') => {
    if (status === 'green') return <DotBadge color="emerald">{t('admin.influencerPayouts.noPending', 'No Pending')}</DotBadge>;
    if (status === 'yellow') return <DotBadge color="amber">{t('admin.influencerPayouts.countdownActive', 'Countdown')}</DotBadge>;
    return <DotBadge color="red">{t('admin.influencerPayouts.overdue', 'Overdue')}</DotBadge>;
  };

  const paymentBadge = (status: string) => {
    switch (status) {
      case 'countdown': return <DotBadge color="amber">{t('admin.influencerPayouts.countdownActive', 'Countdown')}</DotBadge>;
      case 'ready': return <DotBadge color="emerald">{t('admin.influencerPayouts.readyForPayout', 'Ready')}</DotBadge>;
      case 'overdue': return <DotBadge color="red">{t('admin.influencerPayouts.overdue', 'Overdue')}</DotBadge>;
      case 'paid': return <DotBadge color="blue">{t('admin.influencerPayouts.paid', 'Paid')}</DotBadge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  /* ---------- KPI cards config ---------- */
  const kpiCards = [
    {
      label: t('admin.influencerPayouts.totalPendingPayout', 'Total Pending'),
      value: fmtCurrency(summary.totalPending),
      icon: DollarSign,
      border: 'border-s-amber-500',
      iconBg: 'bg-amber-500',
    },
    {
      label: t('admin.influencerPayouts.dueThisWeek', 'Due This Week'),
      value: summary.dueThisWeek,
      icon: CalendarClock,
      border: 'border-s-blue-500',
      iconBg: 'bg-blue-500',
    },
    {
      label: t('admin.influencerPayouts.overdue', 'Overdue'),
      value: summary.overdueCount,
      icon: AlertTriangle,
      border: 'border-s-red-500',
      iconBg: 'bg-red-500',
      valueClass: summary.overdueCount > 0 ? 'text-red-600 dark:text-red-400' : '',
    },
    {
      label: t('admin.influencerPayouts.totalPaidOut', 'Total Paid Out'),
      value: fmtCurrency(summary.totalPaidOut),
      icon: CheckCircle2,
      border: 'border-s-emerald-500',
      iconBg: 'bg-emerald-500',
      valueClass: 'text-emerald-600 dark:text-emerald-400',
    },
  ];

  /* ---------- Mobile card for an influencer ---------- */
  const renderMobileCard = (row: typeof filtered[0]) => (
    <Card key={row.id} className="rounded-xl hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">{row.name}</p>
          {statusBadge(row.status)}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <span className="block text-foreground font-extrabold text-lg">{row.totalReferred}</span>
            {t('admin.influencerPayouts.totalReferred', 'Referred')}
          </div>
          <div>
            <span className="block text-foreground font-extrabold text-lg">{row.paidStudents}</span>
            {t('admin.influencerPayouts.paidStudents', 'Paid')}
          </div>
          <div>
            <span className="block text-foreground font-extrabold text-lg">{row.totalOwed > 0 ? fmtCurrency(row.totalOwed) : '—'}</span>
            {t('admin.influencerPayouts.totalOwed', 'Owed')}
          </div>
          <div>
            <span className="block text-foreground font-extrabold text-lg">{row.totalPaid > 0 ? fmtCurrency(row.totalPaid) : '—'}</span>
            {t('admin.influencerPayouts.totalPaidCol', 'Paid Out')}
          </div>
        </div>
        {row.nextDueDate && (
          <p className="text-xs text-muted-foreground">
            {t('admin.influencerPayouts.nextDueDate', 'Next Due')}: <span className="font-medium text-foreground">{fmtDate(row.nextDueDate)}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {row.pendingCountdown > 0 && <DotBadge color="amber">{row.pendingCountdown} countdown</DotBadge>}
          {row.readyForPayout > 0 && <DotBadge color="emerald">{row.readyForPayout} ready</DotBadge>}
          {row.overdue > 0 && <DotBadge color="red">{row.overdue} overdue</DotBadge>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className={`border-s-[3px] ${kpi.border} rounded-xl hover:shadow-md transition-shadow duration-200`}>
              <CardContent className="p-3 md:p-4 flex items-start gap-3">
                <div className={`p-2 md:p-2.5 rounded-xl ${kpi.iconBg} text-white shadow-sm shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] md:text-xs text-muted-foreground font-medium truncate">{kpi.label}</p>
                  <p className={`font-extrabold text-xl md:text-2xl lg:text-3xl leading-tight ${kpi.valueClass || ''}`}>{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters + Sort */}
      <div className="flex items-center gap-2 overflow-x-auto flex-nowrap pb-1 scrollbar-hide">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {filterButtons.map(fb => (
          <Button
            key={fb.key}
            size="sm"
            variant={filter === fb.key ? 'default' : 'outline'}
            onClick={() => setFilter(fb.key)}
            className={`text-xs rounded-full shrink-0 gap-1.5 ${filter === fb.key ? '' : 'hover:bg-muted/60'}`}
          >
            {fb.dot && <span className={`h-1.5 w-1.5 rounded-full ${fb.dot}`} />}
            {fb.label}
            {filterCounts[fb.key] > 0 && (
              <span className="ml-0.5 text-[10px] opacity-70">({filterCounts[fb.key]})</span>
            )}
          </Button>
        ))}
        <div className="ms-auto flex gap-1 shrink-0">
          <Button size="sm" variant={sortBy === 'due' ? 'secondary' : 'ghost'} onClick={() => setSortBy('due')} className="text-xs rounded-full">
            {t('admin.influencerPayouts.payoutDueDate', 'Due Date')}
          </Button>
          <Button size="sm" variant={sortBy === 'amount' ? 'secondary' : 'ghost'} onClick={() => setSortBy('amount')} className="text-xs rounded-full">
            {t('admin.influencerPayouts.commissionAmount', 'Amount')}
          </Button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-base font-medium">{t('admin.influencerPayouts.noPayoutsMsg', 'No influencer payouts to display')}</p>
            <p className="text-sm mt-1 opacity-60">{t('admin.influencerPayouts.noPayoutsSub', 'Payouts will appear here once cases are marked as paid')}</p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <div className="space-y-3">
          {filtered.map(renderMobileCard)}
        </div>
      ) : (
        <Card className="rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="whitespace-nowrap">{t('admin.influencerPayouts.influencerName', 'Influencer')}</TableHead>
                  <TableHead className="text-center whitespace-nowrap">{t('admin.influencerPayouts.totalReferred', 'Referred')}</TableHead>
                  <TableHead className="text-center whitespace-nowrap">{t('admin.influencerPayouts.paidStudents', 'Paid')}</TableHead>
                  <TableHead className="text-center whitespace-nowrap">{t('admin.influencerPayouts.pendingCountdown', 'Countdown')}</TableHead>
                  <TableHead className="text-center whitespace-nowrap">{t('admin.influencerPayouts.readyForPayout', 'Ready')}</TableHead>
                  <TableHead className="text-end whitespace-nowrap">{t('admin.influencerPayouts.totalOwed', 'Owed')}</TableHead>
                  <TableHead className="text-end whitespace-nowrap">{t('admin.influencerPayouts.totalPaidCol', 'Paid Out')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('admin.influencerPayouts.nextDueDate', 'Next Due')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('admin.influencerPayouts.statusCol', 'Status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row, idx) => (
                  <Collapsible key={row.id} open={expandedId === row.id} onOpenChange={(open) => setExpandedId(open ? row.id : null)} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className={`cursor-pointer hover:bg-muted/50 transition-colors ${idx % 2 === 1 ? 'bg-muted/20' : ''}`}>
                          <TableCell className="w-8 px-2">
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expandedId === row.id ? 'rotate-180' : ''}`} />
                          </TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-center">{row.totalReferred}</TableCell>
                          <TableCell className="text-center">{row.paidStudents}</TableCell>
                          <TableCell className="text-center">
                            {row.pendingCountdown > 0 ? <DotBadge color="amber">{row.pendingCountdown}</DotBadge> : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.readyForPayout > 0 ? <DotBadge color="emerald">{row.readyForPayout}</DotBadge> : '—'}
                          </TableCell>
                          <TableCell className="text-end font-semibold">{row.totalOwed > 0 ? fmtCurrency(row.totalOwed) : '—'}</TableCell>
                          <TableCell className="text-end">{row.totalPaid > 0 ? fmtCurrency(row.totalPaid) : '—'}</TableCell>
                          <TableCell>{row.nextDueDate ? fmtDate(row.nextDueDate) : '—'}</TableCell>
                          <TableCell>{statusBadge(row.status)}</TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={10} className="p-0">
                            <div className="border-s-2 border-primary/30 ms-4 bg-muted/20 rounded-lg mx-2 mb-2 px-4 py-3">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs whitespace-nowrap">{t('admin.influencerPayouts.studentName', 'Student')}</TableHead>
                                    <TableHead className="text-xs whitespace-nowrap">{t('admin.influencerPayouts.paidDate', 'Paid Date')}</TableHead>
                                    <TableHead className="text-xs whitespace-nowrap">{t('admin.influencerPayouts.payoutDueDate', 'Due Date')}</TableHead>
                                    <TableHead className="text-xs text-center whitespace-nowrap">{t('admin.influencerPayouts.daysRemaining', 'Days Left')}</TableHead>
                                    <TableHead className="text-xs text-end whitespace-nowrap">{t('admin.influencerPayouts.commissionAmount', 'Commission')}</TableHead>
                                    <TableHead className="text-xs whitespace-nowrap">{t('admin.influencerPayouts.paymentStatus', 'Status')}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {row.caseDetails.map((cd: any) => (
                                    <TableRow key={cd.caseId} className="text-sm">
                                      <TableCell className="text-sm">{cd.studentName}</TableCell>
                                      <TableCell className="text-sm">{fmtDate(cd.paidAt)}</TableCell>
                                      <TableCell className="text-sm">{cd.dueDate ? fmtDate(cd.dueDate) : '—'}</TableCell>
                                      <TableCell className="text-center text-sm">
                                        {cd.paymentStatus === 'paid' ? '—' : (
                                          <span className={cd.daysRemaining <= 0 ? 'text-red-600 dark:text-red-400 font-semibold' : cd.daysRemaining <= 7 ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                                            {cd.daysRemaining > 0 ? `${cd.daysRemaining}d` : `${Math.abs(cd.daysRemaining)}d overdue`}
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-end text-sm font-medium">{fmtCurrency(cd.commission)}</TableCell>
                                      <TableCell className="text-sm">{paymentBadge(cd.paymentStatus)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InfluencerPayoutsTab;
