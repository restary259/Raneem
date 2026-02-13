import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PayoutsManagement: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const [rewards, setRewards] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string; email: string }>>({});
  const [filter, setFilter] = useState('all');
  const isMobile = useIsMobile();

  const fetchRewards = async () => {
    const { data } = await (supabase as any).from('rewards').select('*').order('created_at', { ascending: false });
    if (data) {
      setRewards(data);
      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      if (userIds.length > 0) {
        const { data: profilesData } = await (supabase as any)
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        if (profilesData) {
          const map: Record<string, { full_name: string; email: string }> = {};
          profilesData.forEach((p: any) => { map[p.id] = { full_name: p.full_name, email: p.email }; });
          setProfiles(map);
        }
      }
    }
  };
  useEffect(() => { fetchRewards(); }, []);

  const updateRewardStatus = async (id: string, newStatus: string) => {
    const updateData: any = { status: newStatus };
    if (newStatus === 'paid') updateData.paid_at = new Date().toISOString();
    const { error } = await (supabase as any).from('rewards').update(updateData).eq('id', id);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); return; }
    toast({ title: t('admin.payouts.statusUpdated') }); fetchRewards(); onRefresh?.();
  };

  const totalPending = rewards.filter(r => r.status === 'pending' || r.status === 'approved').reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalPaid = rewards.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount || 0), 0);
  const filtered = filter === 'all' ? rewards : rewards.filter(r => r.status === filter);
  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
  const statusKeys = ['pending', 'approved', 'paid', 'cancelled'];

  const getRequesterName = (userId: string) => profiles[userId]?.full_name || 'غير معروف';
  const getRequesterEmail = (userId: string) => profiles[userId]?.email || '';

  const ActionButtons = ({ reward }: { reward: any }) => {
    if (reward.status === 'paid' || reward.status === 'cancelled') return null;
    return (<div className="flex gap-2">
      <Button size="sm" variant="default" className="min-h-[44px] sm:min-h-0" onClick={() => updateRewardStatus(reward.id, 'paid')}>{t('admin.payouts.pay')}</Button>
      <Button size="sm" variant="destructive" className="min-h-[44px] sm:min-h-0" onClick={() => updateRewardStatus(reward.id, 'cancelled')}>{t('admin.payouts.cancel')}</Button>
    </div>);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="p-3 rounded-xl bg-amber-500"><DollarSign className="h-6 w-6 text-white" /></div><div><p className="text-sm text-muted-foreground">{t('admin.payouts.pendingPayout')}</p><p className="text-2xl font-bold">{totalPending.toLocaleString()} ₪</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="p-3 rounded-xl bg-emerald-600"><DollarSign className="h-6 w-6 text-white" /></div><div><p className="text-sm text-muted-foreground">{t('admin.payouts.totalPaid')}</p><p className="text-2xl font-bold">{totalPaid.toLocaleString()} ₪</p></div></CardContent></Card>
      </div>
      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('admin.payouts.all')} ({rewards.length})</SelectItem>
          {statusKeys.map(s => <SelectItem key={s} value={s}>{String(t(`admin.payouts.statuses.${s}`, { defaultValue: s }))} ({rewards.filter(r => r.status === s).length})</SelectItem>)}
        </SelectContent>
      </Select>
      {isMobile ? (
        <div className="space-y-3">
          {filtered.map(r => (<Card key={r.id} className="overflow-hidden"><CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2"><span className="font-semibold text-base">{Number(r.amount).toLocaleString()} ₪</span><Badge variant={r.status === 'paid' ? 'default' : r.status === 'cancelled' ? 'destructive' : 'secondary'}>{String(t(`admin.payouts.statuses.${r.status}`, { defaultValue: r.status }))}</Badge></div>
            <div>
              <p className="text-sm font-medium">{getRequesterName(r.user_id)}</p>
              <p className="text-xs text-muted-foreground">{getRequesterEmail(r.user_id)}</p>
            </div>
            <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(locale)}</span><ActionButtons reward={r} /></div>
          </CardContent></Card>))}
          {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.payouts.noRewards')}</p>}
        </div>
      ) : (
        <Card><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.requester', 'الطالب')}</th>
            <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.amount')}</th>
            <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.status')}</th>
            <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.requestDate')}</th>
            <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.action')}</th>
          </tr></thead><tbody>{filtered.map(r => (
            <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium">{getRequesterName(r.user_id)}</p>
                <p className="text-xs text-muted-foreground">{getRequesterEmail(r.user_id)}</p>
              </td>
              <td className="px-4 py-3 font-medium">{Number(r.amount).toLocaleString()} ₪</td>
              <td className="px-4 py-3"><Badge variant={r.status === 'paid' ? 'default' : r.status === 'cancelled' ? 'destructive' : 'secondary'}>{String(t(`admin.payouts.statuses.${r.status}`, { defaultValue: r.status }))}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString(locale)}</td>
              <td className="px-4 py-3"><ActionButtons reward={r} /></td>
            </tr>
          ))}</tbody></table>
          {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.payouts.noRewards')}</p>}
        </div></CardContent></Card>
      )}
    </div>
  );
};

export default PayoutsManagement;
