import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { exportPDF } from '@/utils/exportUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign, TrendingUp, TrendingDown, Wallet,
  ArrowUpRight, ArrowDownRight, Search, FileText, CheckCircle, X, MessageCircle, Clock
} from 'lucide-react';
import PullToRefresh from '@/components/common/PullToRefresh';


interface MoneyDashboardProps {
  cases: any[];
  leads: any[];
  rewards: any[];
  commissions: any[];
  influencers: any[];
  lawyers: any[];
  onRefresh?: () => void;
  payoutRequests?: any[];
}

type TransactionRow = {
  id: string;
  studentName: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  notes: string;
  direction: 'in' | 'out';
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-muted text-muted-foreground border-muted',
};

const STATUS_DOTS: Record<string, string> = {
  pending: 'bg-amber-500',
  approved: 'bg-blue-500',
  paid: 'bg-emerald-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-muted-foreground',
};

const MoneyDashboard: React.FC<MoneyDashboardProps> = ({
  cases, leads, rewards, commissions, influencers, lawyers, onRefresh, payoutRequests = [],
}) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 50;

  // Reset page on filter change
  useEffect(() => { setTxPage(1); }, [typeFilter, statusFilter, search]);

  const getLeadName = (leadId: string) => leads.find(l => l.id === leadId)?.full_name || '—';
  const getProfileName = (id: string) => {
    const inf = influencers.find(i => i.id === id);
    if (inf) return inf.full_name;
    const law = lawyers.find(l => l.id === id);
    if (law) return law.full_name;
    return '—';
  };

  const handleMarkRewardPaid = async (rewardId: string) => {
    setActionLoading(rewardId);
    const { error } = await (supabase as any)
      .from('rewards')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', rewardId);
    setActionLoading(null);
    if (error) { toast({ variant: 'destructive', description: error.message }); return; }
    // Audit log: compliance trail for financial mutations
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await (supabase as any).from('admin_audit_log').insert({
          admin_id: session.user.id, action: 'mark_reward_paid',
          target_id: rewardId, target_table: 'rewards',
          details: `Admin manually marked reward ${rewardId} as paid`,
        });
      }
    } catch {}
    toast({ title: t('money.markedPaid', 'Marked as paid') });
    onRefresh?.();
  };

  const handleClearReward = async (rewardId: string) => {
    setActionLoading(rewardId);
    const { error } = await (supabase as any)
      .from('rewards')
      .update({ status: 'cancelled' })
      .eq('id', rewardId);
    setActionLoading(null);
    if (error) { toast({ variant: 'destructive', description: error.message }); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await (supabase as any).from('admin_audit_log').insert({
          admin_id: session.user.id, action: 'clear_reward',
          target_id: rewardId, target_table: 'rewards',
          details: `Admin cancelled reward ${rewardId}`,
        });
      }
    } catch {}
    toast({ title: t('money.cleared', 'Cleared') });
    onRefresh?.();
  };

  // Build transaction rows from cases
  const transactions = useMemo(() => {
    const rows: TransactionRow[] = [];
    const paidCases = cases.filter(c => c.case_status === 'paid' || !!c.paid_at);

    paidCases.forEach(c => {
      const name = c.student_full_name || getLeadName(c.lead_id);
      const date = c.paid_at || c.created_at;
      const status = c.case_status === 'paid' || c.paid_at ? 'paid' : 'pending';

      // Service fee (revenue)
      if (c.service_fee > 0) {
        rows.push({ id: `${c.id}-sf`, studentName: name, type: 'service_fee', amount: c.service_fee, currency: 'NIS', status, date, notes: '', direction: 'in' });
      }
      // School commission (revenue)
      if (c.school_commission > 0) {
        rows.push({ id: `${c.id}-sc`, studentName: name, type: 'school_commission', amount: c.school_commission, currency: 'NIS', status, date, notes: '', direction: 'in' });
      }
      // Influencer commission (expense)
      if (c.influencer_commission > 0) {
        rows.push({ id: `${c.id}-ic`, studentName: name, type: 'influencer_payout', amount: c.influencer_commission, currency: 'NIS', status, date, notes: '', direction: 'out' });
      }
      // Lawyer/team member commission (expense)
      if (c.lawyer_commission > 0) {
        rows.push({ id: `${c.id}-lc`, studentName: name, type: 'team_member_comm', amount: c.lawyer_commission, currency: 'NIS', status, date, notes: '', direction: 'out' });
      }
      // Referral discount (expense)
      if (c.referral_discount > 0) {
        rows.push({ id: `${c.id}-rd`, studentName: name, type: 'referral_cashback', amount: c.referral_discount, currency: 'NIS', status, date, notes: '', direction: 'out' });
      }
      // Translation fee (expense)
      if (c.translation_fee > 0) {
        rows.push({ id: `${c.id}-tf`, studentName: name, type: 'translation_fee', amount: c.translation_fee, currency: 'NIS', status, date, notes: '', direction: 'out' });
      }
    });

    // Sort by date desc
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rows;
  }, [cases, leads]);

  // KPI calculations
  const kpis = useMemo(() => {
    const paidCases = cases.filter(c => c.paid_at);
    const totalServiceFees = paidCases.reduce((s, c) => s + (Number(c.service_fee) || 0), 0);
    const totalSchoolComm = paidCases.reduce((s, c) => s + (Number(c.school_commission) || 0), 0);
    const totalTranslation = paidCases.reduce((s, c) => s + (Number(c.translation_fee) || 0), 0);
    const totalInfluencerComm = paidCases.reduce((s, c) => s + (Number(c.influencer_commission) || 0), 0);
    const totalLawyerComm = paidCases.reduce((s, c) => s + (Number(c.lawyer_commission) || 0), 0);
    const totalReferralDiscount = paidCases.reduce((s, c) => s + (Number(c.referral_discount) || 0), 0);

    const totalRevenueNIS = totalServiceFees + totalSchoolComm;
    const totalExpensesNIS = totalInfluencerComm + totalLawyerComm + totalReferralDiscount + totalTranslation;
    const netProfitNIS = totalRevenueNIS - totalExpensesNIS;

    const pendingPayouts = rewards.filter(r => r.status === 'pending' || r.status === 'approved').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const paidPayouts = rewards.filter(r => r.status === 'paid').reduce((s, r) => s + (Number(r.amount) || 0), 0);

    return {
      totalRevenueNIS, totalExpensesNIS, netProfitNIS,
      totalServiceFees, totalSchoolComm, totalInfluencerComm, totalLawyerComm,
      totalReferralDiscount, totalTranslation, pendingPayouts, paidPayouts,
      paidStudents: paidCases.length,
    };
  }, [cases, rewards]);

  // Filtered transactions
  const filtered = useMemo(() => {
    let rows = transactions;
    if (typeFilter !== 'all') rows = rows.filter(r => r.type === typeFilter);
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.studentName.toLowerCase().includes(q));
    }
    return rows;
  }, [transactions, typeFilter, statusFilter, search]);

  const typeLabel = (type: string) => t(`money.types.${type}`, type);
  const statusLabel = (status: string) => t(`money.statuses.${status}`, status);

  const auditFinancialExport = async (format: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await (supabase as any).from('admin_audit_log').insert({
          admin_id: session.user.id, action: `financial_export_${format}`,
          target_table: 'student_cases',
          details: `Exported ${filtered.length} financial records as ${format}`,
        });
      }
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Payout Requests — Admin Approval Panel */}
      {(() => {
        const pending = payoutRequests.filter((r: any) => r.status === 'pending' || r.status === 'approved');
        if (pending.length === 0) return null;
        return (
          <Card className="border-blue-300 bg-blue-50/40">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-sm">{t('money.payoutRequests', 'Payout Requests')} ({pending.length})</h3>
              </div>
              <div className="space-y-2">
                {pending.map((req: any) => {
                  const requesterName = getProfileName(req.requestor_id);
                  const WHATSAPP_URL = 'https://api.whatsapp.com/message/IVC4VCAEJ6TBD1';
                  return (
                    <div key={req.id} className="flex items-center justify-between gap-3 p-3 bg-background rounded-lg border">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{requesterName}</p>
                          <Badge variant="secondary" className="text-[10px] capitalize">{req.requestor_role}</Badge>
                          <Badge variant={req.status === 'approved' ? 'default' : 'secondary'} className="text-[10px]">{req.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {Number(req.amount).toLocaleString()} ₪ · {new Date(req.requested_at).toLocaleDateString()}
                          {req.payment_method && ` · ${req.payment_method.slice(0, 40)}`}
                        </p>
                        {(() => {
                          // Show 20-day payout eligibility for linked rewards
                          const linkedCases = cases.filter(c => c.paid_countdown_started_at);
                          if (linkedCases.length > 0) {
                            const latestPaid = linkedCases.reduce((latest, c) => {
                              const d = new Date(c.paid_countdown_started_at);
                              return d > latest ? d : latest;
                            }, new Date(0));
                            const eligibleDate = new Date(latestPaid.getTime() + 20 * 24 * 60 * 60 * 1000);
                            const now = new Date();
                            if (now < eligibleDate) {
                              const daysLeft = Math.ceil((eligibleDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
                              return <p className="text-[10px] text-amber-700 font-medium mt-0.5">🔒 {t('money.payoutEligibleIn', { days: daysLeft, defaultValue: 'Payout eligible in {{days}} days' })}</p>;
                            }
                            return <p className="text-[10px] text-emerald-700 font-medium mt-0.5">✅ {t('money.payoutEligible', { date: eligibleDate.toLocaleDateString(), defaultValue: 'Eligible since {{date}}' })}</p>;
                          }
                          return null;
                        })()}
                        {req.linked_student_names?.length > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            {t('money.students')}: {req.linked_student_names.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-green-500 text-green-700 hover:bg-green-50"
                          onClick={() => window.open(WHATSAPP_URL, '_blank')}
                        >
                          <MessageCircle className="h-3 w-3" />
                          WA
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs gap-1"
                          disabled={actionLoading === req.id}
                          onClick={async () => {
                            setActionLoading(req.id);
                            const { error } = await (supabase as any)
                              .from('payout_requests')
                              .update({ status: 'paid', paid_at: new Date().toISOString() })
                              .eq('id', req.id);
                            setActionLoading(null);
                            if (error) { toast({ variant: 'destructive', description: error.message }); return; }
                            // Also mark linked rewards as paid
                            if (req.linked_reward_ids?.length) {
                              await (supabase as any).from('rewards')
                                .update({ status: 'paid', paid_at: new Date().toISOString() })
                                .in('id', req.linked_reward_ids);
                            }
                            // Audit log: financial compliance trail
                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              if (session?.user) {
                                await (supabase as any).from('admin_audit_log').insert({
                                  admin_id: session.user.id, action: 'mark_payout_paid',
                                  target_id: req.id, target_table: 'payout_requests',
                                  details: `Admin paid payout request ${req.id} — amount: ${req.amount} ₪ — requestor: ${req.requestor_id}`,
                                });
                              }
                            } catch {}
                            toast({ title: t('money.markedPaid', 'Marked as paid') });
                            onRefresh?.();
                          }}
                        >
                          <CheckCircle className="h-3 w-3" />
                          {t('money.markPaid', 'Mark Paid')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                          disabled={actionLoading === req.id}
                          onClick={async () => {
                            setActionLoading(req.id);
                            const { error } = await (supabase as any)
                              .from('payout_requests')
                              .update({ status: 'rejected', reject_reason: 'Rejected by admin' })
                              .eq('id', req.id);
                            // Restore rewards to pending so they can be re-requested
                            if (!error && req.linked_reward_ids?.length) {
                              await (supabase as any).from('rewards')
                                .update({ status: 'pending', payout_requested_at: null })
                                .in('id', req.linked_reward_ids);
                            }
                            setActionLoading(null);
                            if (error) { toast({ variant: 'destructive', description: error.message }); return; }
                            toast({ title: t('money.rejected', 'Request rejected') });
                            onRefresh?.();
                          }}
                        >
                          <X className="h-3 w-3" />
                          {t('money.reject', 'Reject')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Pending Rewards — Manual Payout Controls */}
      {(() => {
        const pendingRewards = rewards.filter(r => r.status === 'pending');
        if (pendingRewards.length === 0) return null;
        return (
          <Card className="border-amber-300 bg-amber-50/40">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-amber-600" />
                <h3 className="font-semibold text-sm">{t('money.pendingPayouts', 'Pending Payouts')} ({pendingRewards.length})</h3>
              </div>
              <div className="space-y-2">
                {pendingRewards.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-3 bg-background rounded-lg border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{getProfileName(r.user_id)}</p>
                      <p className="text-xs text-muted-foreground">{r.amount.toLocaleString()} ₪ · {new Date(r.created_at).toLocaleDateString()}</p>
                      {r.admin_notes && <p className="text-[10px] text-muted-foreground truncate">{r.admin_notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs gap-1"
                        disabled={actionLoading === r.id}
                        onClick={() => handleMarkRewardPaid(r.id)}
                      >
                        <CheckCircle className="h-3 w-3" />
                        {t('money.markPaid', 'Mark Paid')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                        disabled={actionLoading === r.id}
                        onClick={() => handleClearReward(r.id)}
                      >
                        <X className="h-3 w-3" />
                        {t('money.clear', 'Clear')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">{t('money.totalRevenueNIS')}</span>
            </div>
            <p className="text-xl font-bold text-emerald-700">{kpis.totalRevenueNIS.toLocaleString()} ₪</p>
            <p className="text-[10px] text-muted-foreground">{kpis.paidStudents} {t('money.students')}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">{t('money.schoolCommission', 'School Commission')}</span>
            </div>
            <p className="text-xl font-bold text-blue-700">{kpis.totalSchoolComm.toLocaleString()} ₪</p>
            <p className="text-[10px] text-muted-foreground">{t('money.schoolCommissions')}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="text-xs text-muted-foreground">{t('money.totalExpenses')}</span>
            </div>
            <p className="text-xl font-bold text-red-700">{kpis.totalExpensesNIS.toLocaleString()} ₪</p>
          </CardContent>
        </Card>
        <Card className={`border-2 ${kpis.netProfitNIS >= 0 ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4" />
              <span className="text-xs text-muted-foreground">{t('money.netProfit')}</span>
            </div>
            <p className={`text-xl font-bold ${kpis.netProfitNIS >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{kpis.netProfitNIS.toLocaleString()} ₪</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">{t('money.pendingPayouts')}</span>
            </div>
            <p className="text-xl font-bold text-amber-700">{kpis.pendingPayouts.toLocaleString()} ₪</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">{t('money.totalPaidOut')}</span>
            </div>
            <p className="text-xl font-bold text-emerald-700">{kpis.paidPayouts.toLocaleString()} ₪</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t('money.types.service_fee'), value: kpis.totalServiceFees, color: 'text-emerald-700', icon: ArrowUpRight },
          { label: t('money.types.school_commission'), value: kpis.totalSchoolComm, color: 'text-blue-700', icon: ArrowUpRight },
          { label: t('money.types.influencer_payout'), value: kpis.totalInfluencerComm, color: 'text-red-600', icon: ArrowDownRight },
          { label: t('money.types.team_member_comm'), value: kpis.totalLawyerComm, color: 'text-red-600', icon: ArrowDownRight },
          { label: t('money.types.referral_cashback'), value: kpis.totalReferralDiscount, color: 'text-red-600', icon: ArrowDownRight },
          { label: t('money.types.translation_fee'), value: kpis.totalTranslation, color: 'text-red-600', icon: ArrowDownRight },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Icon className={`h-3 w-3 ${item.color}`} />
                  <span className="text-[10px] text-muted-foreground truncate">{item.label}</span>
                </div>
                <p className={`text-sm font-bold ${item.color}`}>{item.value.toLocaleString()} ₪</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('money.searchStudent')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t('money.revenueType')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.leads.all', 'All')}</SelectItem>
            {['service_fee', 'school_commission', 'influencer_payout', 'team_member_comm', 'referral_cashback', 'translation_fee'].map(type => (
              <SelectItem key={type} value={type}>{typeLabel(type)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.leads.all', 'All')}</SelectItem>
            <SelectItem value="pending">{t('money.statuses.pending')}</SelectItem>
            <SelectItem value="paid">{t('money.statuses.paid')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            auditFinancialExport('pdf');
            const headers = [t('money.student'), t('money.revenueType'), t('money.amount'), t('money.currency'), t('money.status'), t('money.date')];
            const rows = filtered.map(r => [r.studentName, typeLabel(r.type), r.amount, r.currency, statusLabel(r.status), new Date(r.date).toLocaleDateString()]);
            const totalIn = filtered.filter(r => r.direction === 'in').reduce((s,r) => s + r.amount, 0);
            const totalOut = filtered.filter(r => r.direction === 'out').reduce((s,r) => s + r.amount, 0);
            exportPDF({ headers, rows, fileName: `money-${new Date().toISOString().slice(0,10)}`, title: 'Darb Study — Financial Report', summaryRows: [['Total Revenue', '', totalIn, '', '', ''], ['Total Expenses', '', totalOut, '', '', ''], ['Net', '', totalIn - totalOut, '', '', '']] });
          }}><FileText className="h-4 w-4 me-1" />PDF</Button>
        </div>
      </div>

      {/* Transaction count + Pagination info */}
      <p className="text-sm text-muted-foreground">{filtered.length} {t('money.transactions', { defaultValue: 'transactions' })}</p>

      {/* Transaction Table / Cards */}
      {(() => {
        const txTotalPages = Math.ceil(filtered.length / TX_PAGE_SIZE);
        const paginatedTx = filtered.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE);
        return (
          <>
            {isMobile ? (
              <div className="space-y-3">
                {paginatedTx.map(row => (
                  <Card key={row.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{row.studentName}</p>
                        <Badge className={`${STATUS_COLORS[row.status] || 'bg-muted text-muted-foreground'} border`}>
                          <span className={`w-1.5 h-1.5 rounded-full me-1.5 ${STATUS_DOTS[row.status] || 'bg-muted-foreground'}`} />
                          {statusLabel(row.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{typeLabel(row.type)}</span>
                        <span className={`font-bold ${row.direction === 'in' ? 'text-emerald-700' : 'text-red-600'}`}>
                          {row.direction === 'in' ? '+' : '-'}{row.amount.toLocaleString()} {row.currency}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{new Date(row.date).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                ))}
                {filtered.length === 0 && (
                  <div className="py-16 text-center">
                    <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">{t('money.noTransactions')}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{t('money.noTransactionsDesc', { defaultValue: 'Transactions will appear after cases are paid' })}</p>
                  </div>
                )}
              </div>
            ) : (
              <Card className="w-full overflow-hidden rounded-xl">
                <div className="w-full overflow-x-auto">
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="w-[22%] px-4 py-3 text-start font-semibold">{t('money.student')}</th>
                          <th className="w-[22%] px-4 py-3 text-start font-semibold">{t('money.revenueType')}</th>
                          <th className="w-[16%] px-4 py-3 text-start font-semibold">{t('money.amount')}</th>
                          <th className="w-[12%] px-4 py-3 text-start font-semibold">{t('money.currency')}</th>
                          <th className="w-[14%] px-4 py-3 text-start font-semibold">{t('money.status')}</th>
                          <th className="w-[14%] px-4 py-3 text-start font-semibold">{t('money.date')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTx.map((row, idx) => (
                          <tr key={row.id} className={`border-b hover:bg-muted/50 transition-colors ${idx % 2 === 1 ? 'bg-muted/20' : ''}`}>
                            <td className="px-4 py-3 font-medium">{row.studentName}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                {row.direction === 'in' ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />}
                                <span>{typeLabel(row.type)}</span>
                              </div>
                            </td>
                            <td className={`px-4 py-3 font-bold ${row.direction === 'in' ? 'text-emerald-700' : 'text-red-600'}`}>
                              {row.direction === 'in' ? '+' : '-'}{row.amount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{row.currency}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[row.status] || 'bg-muted border-muted'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[row.status] || 'bg-muted-foreground'}`} />
                                {statusLabel(row.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(row.date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filtered.length === 0 && (
                      <div className="py-16 text-center">
                        <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground font-medium">{t('money.noTransactions')}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">{t('money.noTransactionsDesc', { defaultValue: 'Transactions will appear after cases are paid' })}</p>
                      </div>
                    )}
                </div>
              </Card>
            )}
            {txTotalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => setTxPage(p => Math.max(1, p - 1))} aria-disabled={txPage === 1} className={txPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-4 py-2 text-sm text-muted-foreground">{txPage} / {txTotalPages}</span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext onClick={() => setTxPage(p => Math.min(txTotalPages, p + 1))} aria-disabled={txPage === txTotalPages} className={txPage === txTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        );
      })()}
    </div>
  );
};

export default MoneyDashboard;
