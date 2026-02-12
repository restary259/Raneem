import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Gift, Trophy, Award, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RewardsPanelProps {
  userId: string;
}

const RewardsPanel: React.FC<RewardsPanelProps> = ({ userId }) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const [rewards, setRewards] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);

  const MILESTONE_ICONS: Record<string, React.ReactNode> = {
    first_referral: <Star className="h-5 w-5 text-amber-500" />,
    '5_referrals': <Award className="h-5 w-5 text-blue-500" />,
    '10_referrals': <Trophy className="h-5 w-5 text-purple-500" />,
  };

  useEffect(() => {
    const fetchData = async () => {
      const [rewardsRes, milestonesRes] = await Promise.all([
        (supabase as any).from('rewards').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        (supabase as any).from('referral_milestones').select('*').eq('user_id', userId),
      ]);
      if (rewardsRes.data) setRewards(rewardsRes.data);
      if (milestonesRes.data) setMilestones(milestonesRes.data);
    };
    fetchData();
  }, [userId]);

  const totalEarned = rewards.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const pendingAmount = rewards.filter(r => r.status === 'pending' || r.status === 'approved').reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const paidAmount = rewards.filter(r => r.status === 'paid').reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const requestPayout = async () => {
    const pendingRewards = rewards.filter(r => r.status === 'pending');
    if (!pendingRewards.length) {
      toast({ title: t('rewards.noPendingRewards') });
      return;
    }
    for (const r of pendingRewards) {
      await (supabase as any).from('rewards').update({
        status: 'approved',
        payout_requested_at: new Date().toISOString(),
      }).eq('id', r.id);
    }
    toast({ title: t('rewards.payoutRequested') });
    const { data } = await (supabase as any).from('rewards').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setRewards(data);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-600"><Gift className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">{t('rewards.totalRewards')}</p><p className="text-2xl font-bold">{totalEarned.toLocaleString()} ₪</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500"><Gift className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">{t('rewards.pending')}</p><p className="text-2xl font-bold">{pendingAmount.toLocaleString()} ₪</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-600"><Gift className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">{t('rewards.paid')}</p><p className="text-2xl font-bold">{paidAmount.toLocaleString()} ₪</p></div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={requestPayout} className="w-full sm:w-auto">
        {t('rewards.requestPayout')}
      </Button>

      {milestones.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('rewards.achievements')}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {milestones.map(m => (
                <div key={m.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-2">
                  {MILESTONE_ICONS[m.milestone_type] || <Star className="h-5 w-5" />}
                  <span className="font-medium text-sm">{String(t(`rewards.milestones.${m.milestone_type}`, { defaultValue: m.milestone_type }))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">{t('rewards.rewardsHistory')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rewards.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">{t('rewards.noRewards')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-semibold">{t('rewards.amountCol')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('rewards.statusCol')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('rewards.dateCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map(r => (
                    <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{Number(r.amount).toLocaleString()} ₪</td>
                      <td className="px-4 py-3"><Badge variant={r.status === 'paid' ? 'default' : r.status === 'cancelled' ? 'destructive' : 'secondary'}>{String(t(`rewards.statuses.${r.status}`, { defaultValue: r.status }))}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RewardsPanel;
