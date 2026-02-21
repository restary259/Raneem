import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle2, DollarSign, Users, CalendarClock, Filter } from 'lucide-react';

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

/* ---------- component ---------- */

const InfluencerPayoutsTab: React.FC<Props> = ({ cases, leads, influencers, rewards, payoutRequests }) => {
  const { t } = useTranslation('dashboard');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'due' | 'amount'>('due');

  /* Build per-influencer aggregation */
  const { rows, summary } = useMemo(() => {
    const now = Date.now();

    // Map lead_id → lead
    const leadMap = new Map(leads.map((l: any) => [l.id, l]));

    // Map case → lead → influencer
    // Only paid cases with influencer source
    const paidCases = cases.filter((c: any) =>
      c.case_status === 'paid' && !c.deleted_at
    );

    // Group cases by influencer id
    const infCaseMap = new Map<string, any[]>();
    for (const cs of paidCases) {
      const lead = leadMap.get(cs.lead_id);
      if (!lead || lead.source_type !== 'influencer' || !lead.source_id) continue;
      const infId = lead.source_id;
      if (!infCaseMap.has(infId)) infCaseMap.set(infId, []);
      infCaseMap.get(infId)!.push({ ...cs, _lead: lead });
    }

    // Influencer rewards map: userId → rewards[]
    const infRewardMap = new Map<string, any[]>();
    for (const r of rewards) {
      if (!infRewardMap.has(r.user_id)) infRewardMap.set(r.user_id, []);
      infRewardMap.get(r.user_id)!.push(r);
    }

    // Payout requests by requestor
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

        // Find matching reward for this case (via admin_notes containing case id)
        const matchingReward = infRewards.find((r: any) =>
          r.admin_notes?.includes(cs.id)
        );
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
          // countdown expired
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

      // Status badge
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

    return {
      rows,
      summary: { totalPending, dueThisWeek, overdueCount, totalPaidOut },
    };
  }, [cases, leads, influencers, rewards, payoutRequests]);

  /* Filter rows */
  const filtered = useMemo(() => {
    let result = rows;
    switch (filter) {
      case 'ready':
        result = rows.filter(r => r.readyForPayout > 0);
        break;
      case 'overdue':
        result = rows.filter(r => r.overdue > 0);
        break;
      case 'due7':
        result = rows.filter(r => r.caseDetails.some((c: any) => c.paymentStatus === 'countdown' && c.daysRemaining <= 7 && c.daysRemaining > 0));
        break;
      case 'pending':
        result = rows.filter(r => r.pendingCountdown > 0 || r.readyForPayout > 0 || r.overdue > 0);
        break;
    }
    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'amount') return b.totalOwed - a.totalOwed;
      // by due date ascending (nulls last)
      const aD = a.nextDueDate?.getTime() ?? Infinity;
      const bD = b.nextDueDate?.getTime() ?? Infinity;
      return aD - bD;
    });
    return result;
  }, [rows, filter, sortBy]);

  const filterButtons: { key: FilterType; label: string; icon?: React.ReactNode }[] = [
    { key: 'all', label: t('admin.influencerPayouts.allPending', 'All') },
    { key: 'ready', label: t('admin.influencerPayouts.readyForPayout', 'Ready') },
    { key: 'overdue', label: t('admin.influencerPayouts.overdueFilter', 'Overdue') },
    { key: 'due7', label: t('admin.influencerPayouts.dueIn7Days', 'Due 7d') },
    { key: 'pending', label: t('admin.influencerPayouts.countdownActive', 'Pending') },
  ];

  const statusBadge = (status: 'green' | 'yellow' | 'red') => {
    if (status === 'green') return <Badge className="bg-emerald-100 text-emerald-800 border-0"><CheckCircle2 className="h-3 w-3 me-1" />{t('admin.influencerPayouts.noPending', 'No Pending')}</Badge>;
    if (status === 'yellow') return <Badge className="bg-amber-100 text-amber-800 border-0"><Clock className="h-3 w-3 me-1" />{t('admin.influencerPayouts.countdownActive', 'Countdown')}</Badge>;
    return <Badge className="bg-red-100 text-red-800 border-0"><AlertTriangle className="h-3 w-3 me-1" />{t('admin.influencerPayouts.overdue', 'Overdue')}</Badge>;
  };

  const paymentBadge = (status: string) => {
    switch (status) {
      case 'countdown': return <Badge className="bg-amber-100 text-amber-800 border-0">🔒 {t('admin.influencerPayouts.countdownActive', 'Countdown')}</Badge>;
      case 'ready': return <Badge className="bg-emerald-100 text-emerald-800 border-0">✅ {t('admin.influencerPayouts.readyForPayout', 'Ready')}</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-800 border-0">🔴 {t('admin.influencerPayouts.overdue', 'Overdue')}</Badge>;
      case 'paid': return <Badge className="bg-blue-100 text-blue-800 border-0">💰 {t('admin.influencerPayouts.paid', 'Paid')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {t('admin.influencerPayouts.totalPendingPayout', 'Total Pending')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmtCurrency(summary.totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              {t('admin.influencerPayouts.dueThisWeek', 'Due This Week')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.dueThisWeek}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t('admin.influencerPayouts.overdue', 'Overdue')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{summary.overdueCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {t('admin.influencerPayouts.totalPaidOut', 'Total Paid Out')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{fmtCurrency(summary.totalPaidOut)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {filterButtons.map(fb => (
          <Button
            key={fb.key}
            size="sm"
            variant={filter === fb.key ? 'default' : 'outline'}
            onClick={() => setFilter(fb.key)}
            className="text-xs"
          >
            {fb.label}
          </Button>
        ))}
        <div className="ms-auto flex gap-1">
          <Button size="sm" variant={sortBy === 'due' ? 'secondary' : 'ghost'} onClick={() => setSortBy('due')} className="text-xs">
            {t('admin.influencerPayouts.payoutDueDate', 'Due Date')}
          </Button>
          <Button size="sm" variant={sortBy === 'amount' ? 'secondary' : 'ghost'} onClick={() => setSortBy('amount')} className="text-xs">
            {t('admin.influencerPayouts.commissionAmount', 'Amount')}
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{t('admin.influencerPayouts.noPayoutsMsg', 'No influencer payouts to display')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>{t('admin.influencerPayouts.influencerName', 'Influencer')}</TableHead>
                  <TableHead className="text-center">{t('admin.influencerPayouts.totalReferred', 'Referred')}</TableHead>
                  <TableHead className="text-center">{t('admin.influencerPayouts.paidStudents', 'Paid')}</TableHead>
                  <TableHead className="text-center">{t('admin.influencerPayouts.pendingCountdown', 'Countdown')}</TableHead>
                  <TableHead className="text-center">{t('admin.influencerPayouts.readyForPayout', 'Ready')}</TableHead>
                  <TableHead className="text-end">{t('admin.influencerPayouts.totalOwed', 'Owed')}</TableHead>
                  <TableHead className="text-end">{t('admin.influencerPayouts.totalPaidCol', 'Paid Out')}</TableHead>
                  <TableHead>{t('admin.influencerPayouts.nextDueDate', 'Next Due')}</TableHead>
                  <TableHead>{t('admin.influencerPayouts.statusCol', 'Status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(row => (
                  <Collapsible key={row.id} open={expandedId === row.id} onOpenChange={(open) => setExpandedId(open ? row.id : null)} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <TableCell>
                            {expandedId === row.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-center">{row.totalReferred}</TableCell>
                          <TableCell className="text-center">{row.paidStudents}</TableCell>
                          <TableCell className="text-center">
                            {row.pendingCountdown > 0 ? (
                              <Badge className="bg-amber-100 text-amber-800 border-0">{row.pendingCountdown}</Badge>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.readyForPayout > 0 ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-0">{row.readyForPayout}</Badge>
                            ) : '—'}
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
                            <div className="bg-muted/30 px-6 py-3">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{t('admin.influencerPayouts.studentName', 'Student')}</TableHead>
                                    <TableHead>{t('admin.influencerPayouts.paidDate', 'Paid Date')}</TableHead>
                                    <TableHead>{t('admin.influencerPayouts.payoutDueDate', 'Due Date')}</TableHead>
                                    <TableHead className="text-center">{t('admin.influencerPayouts.daysRemaining', 'Days Left')}</TableHead>
                                    <TableHead className="text-end">{t('admin.influencerPayouts.commissionAmount', 'Commission')}</TableHead>
                                    <TableHead>{t('admin.influencerPayouts.paymentStatus', 'Status')}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {row.caseDetails.map((cd: any) => (
                                    <TableRow key={cd.caseId}>
                                      <TableCell>{cd.studentName}</TableCell>
                                      <TableCell>{fmtDate(cd.paidAt)}</TableCell>
                                      <TableCell>{cd.dueDate ? fmtDate(cd.dueDate) : '—'}</TableCell>
                                      <TableCell className="text-center">
                                        {cd.paymentStatus === 'paid' ? '—' : (
                                          <span className={cd.daysRemaining <= 0 ? 'text-destructive font-semibold' : cd.daysRemaining <= 7 ? 'text-amber-600 font-semibold' : ''}>
                                            {cd.daysRemaining > 0 ? `${cd.daysRemaining}d` : `${Math.abs(cd.daysRemaining)}d overdue`}
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-end font-medium">{fmtCurrency(cd.commission)}</TableCell>
                                      <TableCell>{paymentBadge(cd.paymentStatus)}</TableCell>
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
