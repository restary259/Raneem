import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { Link2, RefreshCw, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { discountAppliedFromCase } from '@/lib/referralDiscount';

type ReferralStatus = 'pending' | 'contacted' | 'enrolled' | 'rewarded';

const STATUSES: ReferralStatus[] = ['pending', 'contacted', 'enrolled', 'rewarded'];

const STATUS_VARIANT: Record<ReferralStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  contacted: 'outline',
  enrolled: 'default',
  rewarded: 'default',
};

interface AdminReferralRow {
  id: string;
  referrer_user_id: string;
  referred_case_id: string | null;
  referred_name: string;
  referred_phone: string;
  discount_applied: boolean;
  status: ReferralStatus;
  created_at: string;
  referrer: { full_name: string; phone_number: string | null } | null;
  linkedCase: { id: string; full_name: string; case_reference: string | null; referral_discount: number | null } | null;
}

const AdminReferralsPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState<AdminReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | ReferralStatus>('all');
  const [query, setQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminReferralRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: referrals, error } = await (supabase as any)
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setLoading(false);
      return;
    }
    const raw = (referrals || []) as AdminReferralRow[];
    const referrerIds = [...new Set(raw.map(r => r.referrer_user_id))];
    const caseIds = [...new Set(raw.map(r => r.referred_case_id).filter(Boolean)) as Set<string>];

    const [profilesRes, casesRes] = await Promise.all([
      referrerIds.length
        ? (supabase as any).from('profiles').select('id, full_name, phone_number').in('id', referrerIds)
        : Promise.resolve({ data: [] }),
      caseIds.length
        ? (supabase as any).from('cases').select('id, full_name, case_reference, referral_discount').in('id', caseIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profilesById = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
    const casesById = new Map((casesRes.data || []).map((c: any) => [c.id, c]));

    setRows(raw.map(r => ({
      ...r,
      referrer: r.referrer_user_id ? profilesById.get(r.referrer_user_id) ?? null : null,
      linkedCase: r.referred_case_id ? casesById.get(r.referred_case_id) ?? null : null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: ReferralStatus) => {
    const prev = rows.find(r => r.id === id);
    setRows(prevRows => prevRows.map(r => (r.id === id ? { ...r, status } : r)));
    const { error } = await (supabase as any).from('referrals').update({ status }).eq('id', id);
    if (error) {
      setRows(prevRows => prevRows.map(r => (r.id === id && prev ? { ...r, status: prev.status } : r)));
      toast({ variant: 'destructive', description: t('admin.referralsMgmt.updateFailed') });
      return;
    }
    toast({ description: t('admin.referralsMgmt.statusUpdated') });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await (supabase as any).from('referrals').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast({ variant: 'destructive', description: t('admin.referralsMgmt.deleteFailed') });
      return;
    }
    setRows(prevRows => prevRows.filter(r => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast({ description: t('admin.referralsMgmt.deleted') });
  };

  const filtered = rows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.referred_name.toLowerCase().includes(q)
      || r.referred_phone.toLowerCase().includes(q)
      || (r.referrer?.full_name ?? '').toLowerCase().includes(q)
    );
  });

  const dateFormat = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-US');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-primary" />
            {t('admin.referralsMgmt.title')}
            <Badge variant="secondary">{rows.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                key="all"
                size="sm"
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
              >
                {t('admin.referralsMgmt.all')}
              </Button>
              {STATUSES.map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(s)}
                >
                  {String(t(`referrals.statuses.${s}`, { defaultValue: s }))}
                </Button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('admin.referralsMgmt.searchPlaceholder')}
              />
            </div>
          </div>

          {loading ? (
            <p className="py-10 text-center text-muted-foreground">{t('admin.referralsMgmt.loading')}</p>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
              {t('admin.referralsMgmt.noReferrals')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('admin.referralsMgmt.referrer')}</th>
                    <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('admin.referralsMgmt.referred')}</th>
                    <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('admin.referralsMgmt.caseRef')}</th>
                    <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('admin.referralsMgmt.discount')}</th>
                    <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('admin.referralsMgmt.status')}</th>
                    <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('admin.referralsMgmt.date')}</th>
                    <th className="px-4 py-3 text-end font-semibold whitespace-nowrap">{t('admin.referralsMgmt.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium">{r.referrer?.full_name || '—'}</div>
                        {r.referrer?.phone_number && (
                          <div className="text-xs text-muted-foreground" dir="ltr">{r.referrer.phone_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium">{r.referred_name}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">{r.referred_phone}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.linkedCase ? (
                          <Button
                            variant="link"
                            className="h-auto p-0 text-sm font-medium"
                            onClick={() => navigate(`/admin/cases/${r.linkedCase!.id}`)}
                          >
                            {r.linkedCase.case_reference || r.linkedCase.id.slice(0, 8)}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {discountAppliedFromCase(r.linkedCase?.referral_discount)
                          ? t('admin.referralsMgmt.yes')
                          : t('admin.referralsMgmt.no')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Select
                          value={r.status}
                          onValueChange={v => updateStatus(r.id, v as ReferralStatus)}
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue>
                              <Badge variant={STATUS_VARIANT[r.status] || 'secondary'}>
                                {String(t(`referrals.statuses.${r.status}`, { defaultValue: r.status }))}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => (
                              <SelectItem key={s} value={s}>
                                {String(t(`referrals.statuses.${s}`, { defaultValue: s }))}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{dateFormat(r.created_at)}</td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(r)}
                          aria-label={t('admin.referralsMgmt.delete')}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.referralsMgmt.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.referralsMgmt.deleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.referralsMgmt.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {t('admin.referralsMgmt.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminReferralsPage;
