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
import PartnerProfilePanel, { PartnerDirectoryRow } from './PartnerProfilePanel';

const fmt = (n: number) => `${Number(n || 0).toLocaleString('en-US')} ₪`;

type Filter = 'all' | 'open' | 'balance' | 'settled';

interface Props {
  /** Requests already fetched by the parent (list_payout_requests). */
  requests: any[];
  onRefresh: () => void;
}

/**
 * Partner-first payout surface. Ambassadors are deliberately excluded here —
 * the directory RPC only returns social_media_partner accounts. Ambassador and
 * student requests stay reviewable in the "Other requests" list.
 */
const PartnersDirectory: React.FC<Props> = ({ requests, onRefresh }) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [partners, setPartners] = useState<PartnerDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('list_partner_directory');
    if (error) {
      toast({ variant: 'destructive', title: t('common.actionFailed'), description: error.message });
    } else {
      setPartners((data || []) as PartnerDirectoryRow[]);
    }
    setLoading(false);
  }, [toast, t]);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);
  useRealtimeSubscription('payout_requests', fetchPartners, true);
  useRealtimeSubscription('rewards', fetchPartners, true);

  const refreshAll = useCallback(() => { fetchPartners(); onRefresh(); }, [fetchPartners, onRefresh]);

  const requestsByPartner = useMemo(() => {
    const map: Record<string, any[]> = {};
    requests
      .filter(r => r.requestor_role === 'social_media_partner')
      .forEach(r => { (map[r.requestor_id] ||= []).push(r); });
    return map;
  }, [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return partners.filter(p => {
      if (q && ![p.full_name, p.email, p.city, p.referral_code]
        .some(v => (v || '').toLowerCase().includes(q))) return false;
      if (filter === 'open') return Number(p.open_requests) > 0;
      if (filter === 'balance') return Number(p.available_amount) > 0 || Number(p.locked_amount) > 0;
      if (filter === 'settled') return Number(p.open_requests) === 0 && Number(p.available_amount) === 0;
      return true;
    });
  }, [partners, search, filter]);

  const openCount = partners.filter(p => Number(p.open_requests) > 0).length;

  const selected = partners.find(p => p.partner_id === selectedId) || null;
  if (selected) {
    return (
      <PartnerProfilePanel
        partner={selected}
        requests={requestsByPartner[selected.partner_id] || []}
        onBack={() => setSelectedId(null)}
        onRefresh={refreshAll}
      />
    );
  }

  const PartnerCell = ({ p }: { p: PartnerDirectoryRow }) => (
    <div className="min-w-0">
      <p className="font-medium truncate">{p.full_name}</p>
      <p className="text-xs text-muted-foreground truncate">{p.email}{p.city ? ` · ${p.city}` : ''}</p>
    </div>
  );

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
            <SelectItem value="all">{t('admin.payouts.filterAll', 'All partners')} ({partners.length})</SelectItem>
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
        <p className="p-8 text-center text-sm text-muted-foreground">{t('admin.payouts.noPartners', 'No partners found')}</p>
      ) : isMobile ? (
        <div className="space-y-3">
          {filtered.map(p => (
            <Card key={p.partner_id} className="cursor-pointer" onClick={() => setSelectedId(p.partner_id)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <PartnerCell p={p} />
                  {Number(p.open_requests) > 0 && (
                    <Badge variant="secondary">{p.open_requests}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{p.students_count}</span>
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
                  <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colPartner', 'Partner')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.colStudents', 'Students')}</th>
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
                    key={p.partner_id}
                    className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(p.partner_id)}
                  >
                    <td className="px-4 py-3"><PartnerCell p={p} /></td>
                    <td className="px-4 py-3">{Number(p.students_count).toLocaleString('en-US')}</td>
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

export default PartnersDirectory;
