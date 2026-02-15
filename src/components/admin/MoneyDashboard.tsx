import React, { useMemo, useState } from 'react';
import { exportXLSX, exportPDF } from '@/utils/exportUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Users, Download,
  ArrowUpRight, ArrowDownRight, Search, Filter, FileSpreadsheet, FileText
} from 'lucide-react';

interface MoneyDashboardProps {
  cases: any[];
  leads: any[];
  rewards: any[];
  commissions: any[];
  influencers: any[];
  lawyers: any[];
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
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-emerald-100 text-emerald-800',
};

const MoneyDashboard: React.FC<MoneyDashboardProps> = ({
  cases, leads, rewards, commissions, influencers, lawyers,
}) => {
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const getLeadName = (leadId: string) => leads.find(l => l.id === leadId)?.full_name || '—';
  const getProfileName = (id: string) => {
    const inf = influencers.find(i => i.id === id);
    if (inf) return inf.full_name;
    const law = lawyers.find(l => l.id === id);
    if (law) return law.full_name;
    return '—';
  };

  // Build transaction rows from cases
  const transactions = useMemo(() => {
    const rows: TransactionRow[] = [];
    const paidCases = cases.filter(c => ['paid', 'completed', 'ready_to_apply', 'registration_submitted', 'visa_stage', 'settled'].includes(c.case_status));

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
        rows.push({ id: `${c.id}-sc`, studentName: name, type: 'school_commission', amount: c.school_commission, currency: 'EUR', status, date, notes: '', direction: 'in' });
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

    const totalRevenueNIS = totalServiceFees;
    const totalRevenueEUR = totalSchoolComm;
    const totalExpensesNIS = totalInfluencerComm + totalLawyerComm + totalReferralDiscount + totalTranslation;
    const netProfitNIS = totalRevenueNIS - totalExpensesNIS;

    const pendingPayouts = rewards.filter(r => r.status === 'pending' || r.status === 'approved').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const paidPayouts = rewards.filter(r => r.status === 'paid').reduce((s, r) => s + (Number(r.amount) || 0), 0);

    return {
      totalRevenueNIS, totalRevenueEUR, totalExpensesNIS, netProfitNIS,
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

  const exportCSV = () => {
    const headers = [t('money.student'), t('money.revenueType'), t('money.amount'), t('money.currency'), t('money.status'), t('money.date')];
    const rows = filtered.map(r => [r.studentName, typeLabel(r.type), r.amount, r.currency, statusLabel(r.status), new Date(r.date).toLocaleDateString()]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `money-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
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
              <span className="text-xs text-muted-foreground">{t('money.totalRevenueEUR')}</span>
            </div>
            <p className="text-xl font-bold text-blue-700">{kpis.totalRevenueEUR.toLocaleString()} €</p>
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
          { label: t('money.types.school_commission'), value: kpis.totalSchoolComm, color: 'text-blue-700', icon: ArrowUpRight, suffix: '€' },
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
                <p className={`text-sm font-bold ${item.color}`}>{item.value.toLocaleString()} {item.suffix || '₪'}</p>
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
            <SelectItem value="all">{t('common.noData', 'All')}</SelectItem>
            {['service_fee', 'school_commission', 'influencer_payout', 'team_member_comm', 'referral_cashback', 'translation_fee'].map(type => (
              <SelectItem key={type} value={type}>{typeLabel(type)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.noData', 'All')}</SelectItem>
            <SelectItem value="pending">{t('money.statuses.pending')}</SelectItem>
            <SelectItem value="paid">{t('money.statuses.paid')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 me-1" />CSV</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const headers = [t('money.student'), t('money.revenueType'), t('money.amount'), t('money.currency'), t('money.status'), t('money.date')];
            const rows = filtered.map(r => [r.studentName, typeLabel(r.type), r.amount, r.currency, statusLabel(r.status), new Date(r.date).toLocaleDateString()]);
            const totalIn = filtered.filter(r => r.direction === 'in').reduce((s,r) => s + r.amount, 0);
            const totalOut = filtered.filter(r => r.direction === 'out').reduce((s,r) => s + r.amount, 0);
            exportXLSX({ headers, rows, fileName: `money-${new Date().toISOString().slice(0,10)}`, title: 'Darb Study — Financial Report', summaryRows: [['Total Revenue', '', totalIn, '', '', ''], ['Total Expenses', '', totalOut, '', '', ''], ['Net', '', totalIn - totalOut, '', '', '']] });
          }}><FileSpreadsheet className="h-4 w-4 me-1" />XLSX</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const headers = [t('money.student'), t('money.revenueType'), t('money.amount'), t('money.currency'), t('money.status'), t('money.date')];
            const rows = filtered.map(r => [r.studentName, typeLabel(r.type), r.amount, r.currency, statusLabel(r.status), new Date(r.date).toLocaleDateString()]);
            const totalIn = filtered.filter(r => r.direction === 'in').reduce((s,r) => s + r.amount, 0);
            const totalOut = filtered.filter(r => r.direction === 'out').reduce((s,r) => s + r.amount, 0);
            exportPDF({ headers, rows, fileName: `money-${new Date().toISOString().slice(0,10)}`, title: 'Darb Study — Financial Report', summaryRows: [['Total Revenue', '', totalIn, '', '', ''], ['Total Expenses', '', totalOut, '', '', ''], ['Net', '', totalIn - totalOut, '', '', '']] });
          }}><FileText className="h-4 w-4 me-1" />PDF</Button>
        </div>
      </div>

      {/* Transaction Table / Cards */}
      {isMobile ? (
        <div className="space-y-3">
          {filtered.map(row => (
            <Card key={row.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{row.studentName}</p>
                  <Badge className={STATUS_COLORS[row.status] || 'bg-muted text-muted-foreground'}>{statusLabel(row.status)}</Badge>
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
          {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('money.noTransactions')}</p>}
        </div>
      ) : (
        <div className="bg-background rounded-xl border shadow-sm w-full overflow-x-auto">
              <table className="min-w-full table-auto text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-semibold">{t('money.student')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('money.revenueType')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('money.amount')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('money.currency')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('money.status')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('money.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => (
                    <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
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
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[row.status] || 'bg-muted'}`}>
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(row.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('money.noTransactions')}</p>}
        </div>
      )}
    </div>
  );
};

export default MoneyDashboard;
