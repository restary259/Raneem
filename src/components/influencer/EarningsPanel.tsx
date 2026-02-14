import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Gift, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EarningsPanelProps {
  userId: string;
}

const EarningsPanel: React.FC<EarningsPanelProps> = ({ userId }) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const [rewards, setRewards] = useState<any[]>([]);

  const fetchRewards = async () => {
    const { data } = await (supabase as any).from('rewards').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setRewards(data);
  };

  useEffect(() => { fetchRewards(); }, [userId]);

  const totalEarned = rewards.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const pendingAmount = rewards.filter(r => r.status === 'pending' || r.status === 'approved').reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const paidAmount = rewards.filter(r => r.status === 'paid').reduce((sum, r) => sum + Number(r.amount || 0), 0);

  // 20-day timer logic
  const getDaysRemaining = (reward: any) => {
    if (!reward.paid_at && !reward.payout_requested_at) return null;
    const referenceDate = reward.paid_at || reward.created_at;
    const daysSince = Math.floor((Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, 20 - daysSince);
  };

  const canRequestPayout = () => {
    const pendingRewards = rewards.filter(r => r.status === 'pending');
    if (!pendingRewards.length) return false;
    // Check all have passed 20-day timer
    return pendingRewards.every(r => {
      const remaining = getDaysRemaining(r);
      return remaining === null || remaining <= 0;
    });
  };

  const requestPayout = async () => {
    const pendingRewards = rewards.filter(r => r.status === 'pending');
    if (!pendingRewards.length) {
      toast({ title: t('influencer.earnings.noPending') });
      return;
    }
    if (!canRequestPayout()) {
      toast({ title: t('influencer.earnings.waitingPeriod'), variant: 'destructive' });
      return;
    }
    for (const r of pendingRewards) {
      await (supabase as any).from('rewards').update({ status: 'approved', payout_requested_at: new Date().toISOString() }).eq('id', r.id);
    }
    toast({ title: t('influencer.earnings.payoutSuccess') });
    fetchRewards();
  };

  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-600"><DollarSign className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">{t('influencer.earnings.totalEarnings')}</p><p className="text-2xl font-bold">{totalEarned.toLocaleString()} ₪</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500"><Gift className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">{t('influencer.earnings.pending')}</p><p className="text-2xl font-bold">{pendingAmount.toLocaleString()} ₪</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-600"><DollarSign className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">{t('influencer.earnings.paid')}</p><p className="text-2xl font-bold">{paidAmount.toLocaleString()} ₪</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={requestPayout} disabled={!canRequestPayout()}>
          {t('influencer.earnings.requestPayout')}
        </Button>
        {!canRequestPayout() && rewards.some(r => r.status === 'pending') && (
          <div className="flex items-center gap-1 text-sm text-amber-600">
            <Clock className="h-4 w-4" />
            <span>{t('influencer.earnings.waitingPeriod')}</span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">{t('influencer.earnings.earningsHistory')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rewards.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">{t('influencer.earnings.noEarnings')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-semibold">{t('influencer.earnings.amount')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('influencer.earnings.status')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('influencer.earnings.timer')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('influencer.earnings.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map(r => {
                    const daysLeft = getDaysRemaining(r);
                    return (
                      <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{Number(r.amount).toLocaleString()} ₪</td>
                        <td className="px-4 py-3"><Badge variant={r.status === 'paid' ? 'default' : r.status === 'cancelled' ? 'destructive' : 'secondary'}>{String(t(`rewards.statuses.${r.status}`, { defaultValue: r.status }))}</Badge></td>
                        <td className="px-4 py-3">
                          {r.status === 'pending' && daysLeft !== null && daysLeft > 0 ? (
                            <span className="text-amber-600 text-xs flex items-center gap-1"><Clock className="h-3 w-3" />{daysLeft} {t('influencer.earnings.days')}</span>
                          ) : r.status === 'pending' ? (
                            <span className="text-emerald-600 text-xs">{t('influencer.earnings.ready')}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString(locale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EarningsPanel;
