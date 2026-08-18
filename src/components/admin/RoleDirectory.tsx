import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RefreshCw, ChevronRight, Users } from 'lucide-react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { matchesRef } from '@/lib/reference';
import RequesterProfilePanel, { DirectoryRow, PayoutRole } from './RequesterProfilePanel';
import { getRoleLabel } from '@/lib/roleLabels';


const fmt = (n: number) => `${Number(n || 0).toLocaleString('en-US')} ₪`;

type Filter = 'all' | 'open' | 'balance' | 'settled';

const ROLE_RPC: Record<PayoutRole, string> = {
  team_member: 'list_team_directory',
  agent: 'list_agent_directory',
  social_media_partner: 'list_partner_directory',
  ambassador: 'list_ambassador_directory',
  student: 'list_student_directory',
};

interface Props {
  role: PayoutRole;
  /** Requests already fetched by the parent (list_payout_requests). */
  requests: any[];
  onRefresh: () => void;
}

/**
 * Role-segmented payout directory. Fetches the directory RPC for the given
 * role, scopes the shared list_payout_requests rows to that role, and opens a
 * role-tailored RequesterProfilePanel on selection.
 */
const RoleDirectory: React.FC<Props> = ({ role, requests, onRefresh }) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const isPartner = role === 'social_media_partner';
  const isAgent = role === 'agent';
  const isTeam = role === 'team_member';
  const isAmbassador = role === 'ambassador';
  const isStudent = role === 'student';

  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc(ROLE_RPC[role]);
    if (error) {
      toast({ variant: 'destructive', title: t('common.actionFailed'), description: error.message });
    } else {
      setRows((data || []).map((r: any) => ({ ...r, requester_id: r.requester_id || r.partner_id })));
    }
    setLoading(false);
  }, [role, toast, t]);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useRealtimeSubscription('payout_requests', fetchRows, true);
  useRealtimeSubscription('rewards', fetchRows, true);

  const refreshAll = useCallback(() => { fetchRows(); onRefresh(); }, [fetchRows, onRefresh]);

  const requestsByRequester = useMemo(() => {
    const map: Record<string, any[]> = {};
    requests
      .filter(r => r.requestor_role === role)
      .forEach(r => { (map[r.requestor_id] ||= []).push(r); });
    return map;
  }, [requests, role]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(p => {
      const refHit = (requestsByRequester[p.requester_id] || [])
        .some((r: any) => matchesRef(r.payout_reference, q) || (r.case_references || []).some((cr: string) => matchesRef(cr, q)));
      if (q && !refHit && ![p.full_name, p.email, p.city, p.referral_code]
        .some(v => (v || '').toLowerCase().includes(q))) return false;
      if (filter === 'open') return Number(p.open_requests) > 0;
      if (filter === 'balance') return Number(p.available_amount) > 0 || Number(p.locked_amount) > 0;
      if (filter === 'settled') return Number(p.open_requests) === 0 && Number(p.available_amount) === 0;
      return true;
    });
  }, [rows, search, filter, requestsByRequester]);

  const openCount = rows.filter(p => Number(p.open_requests) > 0).length;

  const selected = rows.find(p => p.requester_id === selectedId) || null;
  if (selected) {
    return (
      <RequesterProfilePanel
        role={role}
        row={selected}
        requests={requestsByRequester[selected.requester_id] || []}
        onBack={() => setSelectedId(null)}
        onRefresh={refreshAll}
      />
    );
  }

  const RowCell = ({ p }: { p: DirectoryRow }) => (
    <div className="min-w-0">
      <p className="font-medium truncate flex items-center gap-1.5">
        {p.full_name}
      </p>
      <p className="text-xs text-muted-foreground truncate">
        {p.email}{p.city ? ` · ${p.city}` : ''}
      </p>
    </div>
  );

  const extraHeaderCells = () => {
    const cells: React.ReactNode[] = [];
    if (isPartner) {
      cells.push(
        <th key="students" className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colStudents', 'Students')}</th>,
      );
    } else if (isAgent) {
      cells.push(
        <th key="recruited" className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colRecruited', 'Recruited')}</th>,
      );
    } else if (isAmbassador) {
      cells.push(
        <th key="students" className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colStudents', 'Students')}</th>,
      );
    } else if (isTeam) {
      cells.push(
        <th key="assigned" className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colAssigned', 'Assigned')}</th>,
        <th key="closed" className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colClosed', 'Closed')}</th>,
      );
    } else if (isStudent) {
      cells.push(
        <th key="referrals" className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colReferrals', 'Referrals')}</th>,
        <th key="linked" className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colLinked', 'Linked cases')}</th>,
      );
    }
    return cells;
  };

  const extraCells = (p: DirectoryRow) => {
    const cells: React.ReactNode[] = [];
    if (isPartner) {
      cells.push(
        <td key="students" className="px-4 py-3">{Number(p.students_count || 0).toLocaleString('en-US')}</td>,
      );
    } else if (isAgent) {
      cells.push(
        <td key="recruited" className="px-4 py-3">{Number(p.recruited_count || 0).toLocaleString('en-US')}</td>,
      );
    } else if (isAmbassador) {
      cells.push(
        <td key="students" className="px-4 py-3">{Number(p.students_count || 0).toLocaleString('en-US')}</td>,
      );
    } else if (isTeam) {
      cells.push(
        <td key="assigned" className="px-4 py-3">{Number(p.assigned_cases || 0).toLocaleString('en-US')}</td>,
        <td key="closed" className="px-4 py-3">{Number(p.closed_cases || 0).toLocaleString('en-US')}</td>,
      );
    } else if (isStudent) {
      cells.push(
        <td key="referrals" className="px-4 py-3">{Number(p.referrals_made || 0).toLocaleString('en-US')}</td>,
        <td key="linked" className="px-4 py-3">{Number(p.linked_cases || 0).toLocaleString('en-US')}</td>,
      );
    }
    return cells;
  };

  const mobileExtraLine = (p: DirectoryRow) => {
    const parts: React.ReactNode[] = [];
    if (isTeam) {
      parts.push(
        <span key="assigned">{t('admin.payouts.assignedCases', 'Assigned')}: {Number(p.assigned_cases || 0).toLocaleString('en-US')}</span>,
        <span key="closed">{t('admin.payouts.closedCases', 'Closed')}: {Number(p.closed_cases || 0).toLocaleString('en-US')}</span>,
      );
    } else if (isAgent) {
      parts.push(
        <span key="recruited">{t('admin.payouts.colRecruited', 'Recruited')}: {Number(p.recruited_count || 0).toLocaleString('en-US')}</span>,
      );
    } else if (isAmbassador) {
      parts.push(
        <span key="students"><Users className="h-3.5 w-3.5" />{p.students_count || 0}</span>,
      );
    } else if (isStudent) {
      parts.push(
        <span key="referrals">{t('admin.payouts.referralsMade', 'Referrals')}: {Number(p.referrals_made || 0).toLocaleString('en-US')}</span>,
        <span key="linked">{t('admin.payouts.linkedCases', 'Linked')}: {Number(p.linked_cases || 0).toLocaleString('en-US')}</span>,
      );
    }
    return parts;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('admin.payouts.searchPartners', 'Search by name, email or city')}
            className="ps-9"
          />
        </div>
        <Select value={filter} onValueChange={v => setFilter(v as Filter)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.payouts.filterAllRole', { role: getRoleLabel(role), defaultValue: 'All {{role}}' })} ({rows.length})</SelectItem>
            <SelectItem value="open">{t('admin.payouts.filterOpen', 'Pending requests')} ({openCount})</SelectItem>
            <SelectItem value="balance">{t('admin.payouts.filterBalance', 'Has balance')}</SelectItem>
            <SelectItem value="settled">{t('admin.payouts.filterSettled', 'Settled')}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={refreshAll}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {loading ? (
        <p className="p-8 text-center text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
      ) : filtered.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">{t('admin.payouts.emptyDirectory', 'No results found')}</p>
      ) : isMobile ? (
        <div className="space-y-3">
          {filtered.map(p => (
            <Card key={p.requester_id} className="cursor-pointer" onClick={() => setSelectedId(p.requester_id)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <RowCell p={p} />
                  <div className="flex items-center gap-2">
                    {Number(p.open_requests) > 0 && (
                      <Badge variant="secondary">{p.open_requests}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {mobileExtraLine(p)}
                  <span>{t('admin.payouts.colEarned', 'Earned')}: {fmt(p.total_earned)}</span>
                  <span>{t('admin.payouts.colAvailable', 'Available')}: {fmt(p.available_amount)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="w-full overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colName', 'Name')}</th>
                  {extraHeaderCells()}
                  <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colEarned', 'Earned')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colPaid', 'Paid out')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colLocked', 'Locked (20d)')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colAvailable', 'Available')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colOpen', 'Open requests')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr
                    key={p.requester_id}
                    className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(p.requester_id)}
                  >
                    <td className="px-4 py-3"><RowCell p={p} /></td>
                    {extraCells(p)}
                    <td className="px-4 py-3">{fmt(p.total_earned)}</td>
                    <td className="px-4 py-3">{fmt(p.paid_amount)}</td>
                    <td className="px-4 py-3">{fmt(p.locked_amount)}</td>
                    <td className="px-4 py-3 font-medium">{fmt(p.available_amount)}</td>
                    <td className="px-4 py-3">
                      {Number(p.open_requests) > 0 ? (
                        <Badge variant="secondary">{p.open_requests} · {fmt(p.open_request_amount)}</Badge>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-end"><ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180 inline" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default RoleDirectory;
