import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from 'react-i18next';

const STATUS_KEYS = ['pending', 'contacted', 'enrolled', 'paid', 'rejected'];

const ReferralManagement: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const isMobile = useIsMobile();

  const fetchReferrals = async () => {
    const { data } = await (supabase as any).from('referrals').select('*').order('created_at', { ascending: false });
    if (data) setReferrals(data);
  };

  useEffect(() => { fetchReferrals(); }, []);

  const updateStatus = async (id: string, newStatus: string, referral: any) => {
    const { error } = await (supabase as any).from('referrals').update({ status: newStatus }).eq('id', id);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); return; }
    if (newStatus === 'paid') {
      const amount = referral.referrer_type === 'influencer' ? 2000 : 500;
      await (supabase as any).from('rewards').insert({ user_id: referral.referrer_id, referral_id: id, amount, currency: 'ILS', status: 'pending' });
      const { data: allReferrals } = await (supabase as any).from('referrals').select('id').eq('referrer_id', referral.referrer_id).eq('status', 'paid');
      const count = allReferrals?.length || 0;
      const milestoneMap: Record<number, string> = { 1: 'first_referral', 5: '5_referrals', 10: '10_referrals' };
      if (milestoneMap[count]) {
        const { data: existing } = await (supabase as any).from('referral_milestones').select('id').eq('user_id', referral.referrer_id).eq('milestone_type', milestoneMap[count]);
        if (!existing?.length) { await (supabase as any).from('referral_milestones').insert({ user_id: referral.referrer_id, milestone_type: milestoneMap[count] }); }
      }
    }
    toast({ title: t('admin.referralsMgmt.statusUpdated') }); fetchReferrals(); onRefresh?.();
  };

  const filtered = filter === 'all' ? referrals : referrals.filter(r => r.status === filter);
  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';

  const StatusSelect = ({ referral }: { referral: any }) => (
    <Select value={referral.status} onValueChange={(v) => updateStatus(referral.id, v, referral)}>
      <SelectTrigger className="w-full sm:w-36 h-10 sm:h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>{STATUS_KEYS.map(s => <SelectItem key={s} value={s}>{String(t(`referrals.statuses.${s}`, { defaultValue: s }))}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.referralsMgmt.all')} ({referrals.length})</SelectItem>
            {STATUS_KEYS.map(s => <SelectItem key={s} value={s}>{String(t(`referrals.statuses.${s}`, { defaultValue: s }))} ({referrals.filter(r => r.status === s).length})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isMobile ? (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} className="overflow-hidden"><CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-sm">{r.referred_name}</span><Badge variant="outline">{r.referrer_type === 'influencer' ? t('admin.referralsMgmt.agent') : t('admin.referralsMgmt.student')}</Badge></div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{r.referred_email || '—'}</span><span>{r.is_family ? '✅' : ''}</span></div>
              <div className="flex items-center justify-between gap-2"><StatusSelect referral={r} /><span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString(locale)}</span></div>
            </CardContent></Card>
          ))}
          {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.referralsMgmt.noReferrals')}</p>}
        </div>
      ) : (
        <Card><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.name')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.type')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.email')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.family')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.status')}</th>
              <th className="px-4 py-3 text-start font-semibold">{t('admin.referralsMgmt.date')}</th>
            </tr></thead>
            <tbody>{filtered.map(r => (
              <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{r.referred_name}</td>
                <td className="px-4 py-3"><Badge variant="outline">{r.referrer_type === 'influencer' ? t('admin.referralsMgmt.agent') : t('admin.referralsMgmt.student')}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{r.referred_email || '—'}</td>
                <td className="px-4 py-3">{r.is_family ? '✅' : '—'}</td>
                <td className="px-4 py-3"><StatusSelect referral={r} /></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString(locale)}</td>
              </tr>
            ))}</tbody>
          </table>
          {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.referralsMgmt.noReferrals')}</p>}
        </div></CardContent></Card>
      )}
    </div>
  );
};

export default ReferralManagement;
