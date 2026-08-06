import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from 'react-i18next';
import { Trash2, Download } from 'lucide-react';

const STATUS_KEYS = ['pending', 'contacted', 'enrolled', 'paid', 'rejected'];

// The referrals table has no status column — status is derived from the linked case.
const deriveStatus = (referral: any, caseStatusMap: Record<string, string>): string => {
  const caseStatus = referral.referred_case_id ? caseStatusMap[referral.referred_case_id] : undefined;
  if (!caseStatus) return 'pending';
  if (caseStatus === 'enrollment_paid') return 'paid';
  if (caseStatus === 'cancelled') return 'rejected';
  if (caseStatus === 'submitted' || caseStatus === 'payment_confirmed') return 'enrolled';
  if (caseStatus === 'new') return 'pending';
  return 'contacted';
};

interface ReferralMgmtProps {
  onRefresh?: () => void;
  profiles?: { id: string; full_name: string }[];
}

const ReferralManagement: React.FC<ReferralMgmtProps> = ({ onRefresh, profiles = [] }) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const fetchReferrals = async () => {
    const { data } = await (supabase as any).from('referrals').select('*').order('created_at', { ascending: false });
    const rows = data || [];

    // Derive each referral's status from the linked case (the referrals table has no status column)
    const caseIds = [...new Set(rows.map((r: any) => r.referred_case_id).filter(Boolean))] as string[];
    let caseStatusMap: Record<string, string> = {};
    if (caseIds.length > 0) {
      const { data: caseRows } = await (supabase as any).from('cases').select('id,status').in('id', caseIds);
      (caseRows || []).forEach((c: any) => { caseStatusMap[c.id] = c.status; });
    }

    setReferrals(rows.map((r: any) => ({ ...r, status: deriveStatus(r, caseStatusMap) })));
  };

  useEffect(() => { fetchReferrals(); }, []);

  const getReferrerName = (referral: any) => {
    const p = profiles.find(pr => pr.id === referral.referrer_user_id);
    return p?.full_name || '—';
  };

  const getReferralTypeLabel = (referral: any) => {
    if (referral.is_family) return t('admin.referralsMgmt.familyType', 'Family');
    if (referral.referrer_type === 'influencer') return t('admin.referralsMgmt.agent');
    return t('admin.referralsMgmt.student');
  };


  const handleDelete = async () => {
    if (!deleteId) return;
    await (supabase as any).from('rewards').delete().eq('referral_id', deleteId);
    const { error } = await (supabase as any).from('referrals').delete().eq('id', deleteId);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else { toast({ title: t('admin.referralsMgmt.deleted', 'Referral deleted') }); fetchReferrals(); onRefresh?.(); }
    setDeleteId(null);
  };

  const exportCSV = () => {
    const headers = [t('admin.referralsMgmt.name'), t('admin.referralsMgmt.referredBy', 'Referred By'), t('admin.referralsMgmt.type'), t('admin.referralsMgmt.email'), t('admin.referralsMgmt.family'), t('admin.referralsMgmt.status'), t('admin.referralsMgmt.date')];
    const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
    const rows = filtered.map(r => [
      r.referred_name, getReferrerName(r), getReferralTypeLabel(r), r.referred_email || '', r.is_family ? 'Yes' : 'No',
      r.status, new Date(r.created_at).toLocaleDateString(locale)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map((c: string) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `referrals-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  let filtered = filter === 'all' ? referrals : referrals.filter(r => r.status === filter);
  if (typeFilter !== 'all') {
    filtered = filtered.filter(r => {
      if (typeFilter === 'family') return r.is_family;
      if (typeFilter === 'influencer') return r.referrer_type === 'influencer' && !r.is_family;
      return r.referrer_type === 'student' && !r.is_family;
    });
  }
  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';

  const StatusSelect = ({ referral }: { referral: any }) => (
    <Badge variant={referral.status === 'paid' ? 'default' : referral.status === 'rejected' ? 'destructive' : 'secondary'}>
      {String(t(`referrals.statuses.${referral.status}`, { defaultValue: referral.status }))}
    </Badge>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.referralsMgmt.all')} ({referrals.length})</SelectItem>
              {STATUS_KEYS.map(s => <SelectItem key={s} value={s}>{String(t(`referrals.statuses.${s}`, { defaultValue: s }))} ({referrals.filter(r => r.status === s).length})</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder={t('admin.referralsMgmt.type')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.referralsMgmt.all')}</SelectItem>
              <SelectItem value="family">{t('admin.referralsMgmt.familyType', 'Family')}</SelectItem>
              <SelectItem value="influencer">{t('admin.referralsMgmt.agent')}</SelectItem>
              <SelectItem value="student">{t('admin.referralsMgmt.student')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 me-1" />{t('admin.payouts.exportCSV', 'Export CSV')}</Button>
      </div>

      {isMobile ? (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} className="overflow-hidden"><CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm">{r.referred_name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{getReferralTypeLabel(r)}</Badge>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                <span>{t('admin.referralsMgmt.referredBy', 'Referred By')}: <strong>{getReferrerName(r)}</strong></span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{r.referred_email || '—'}</span><span>{r.is_family ? '✅' : ''}</span></div>
              <div className="flex items-center justify-between gap-2"><StatusSelect referral={r} /><span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString(locale)}</span></div>
            </CardContent></Card>
          ))}
          {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.referralsMgmt.noReferrals')}</p>}
        </div>
      ) : (
        <Card className="w-full overflow-hidden">
          <div className="w-full overflow-x-auto">
           <table className="w-full table-fixed text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="w-[14%] px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.name')}</th>
              <th className="w-[14%] px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.referredBy', 'Referred By')}</th>
              <th className="w-[10%] px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.type')}</th>
              <th className="w-[14%] px-4 py-3 text-start font-semibold">{t('referrals.phone', 'Phone')}</th>
              <th className="w-[16%] px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.email')}</th>
              <th className="w-[7%] px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.family')}</th>
              <th className="w-[11%] px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.status')}</th>
              <th className="w-[8%] px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.date')}</th>
              <th className="w-[6%] px-4 py-3 text-start font-semibold">{t('admin.payouts.action', 'Action')}</th>
            </tr></thead>
            <tbody>{filtered.map(r => (
              <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{r.referred_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{getReferrerName(r)}</td>
                <td className="px-4 py-3"><Badge variant="outline">{getReferralTypeLabel(r)}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{r.referred_phone || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.referred_email || '—'}</td>
                <td className="px-4 py-3">{r.is_family ? '✅' : '—'}</td>
                <td className="px-4 py-3"><StatusSelect referral={r} /></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString(locale)}</td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}</tbody>
          </table>
          {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.referralsMgmt.noReferrals')}</p>}
          </div>
        </Card>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.shared.deleteTitle', 'Confirm Deletion')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.referralsMgmt.deleteDesc', 'This will permanently delete this referral and any associated reward records. This action cannot be undone.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.shared.cancelBtn', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('admin.shared.deleteBtn', 'Delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReferralManagement;
