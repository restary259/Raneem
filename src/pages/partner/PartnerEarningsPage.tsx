import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Clock, CheckCircle2, AlertTriangle, Banknote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DashboardLoading from '@/components/dashboard/DashboardLoading';
import { useDirection } from '@/hooks/useDirection';

const LOCK_DAYS = 20;

function getLockInfo(createdAt: string) {
  const created = new Date(createdAt);
  const unlock = new Date(created.getTime() + LOCK_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const locked = now < unlock;
  const daysLeft = locked ? Math.ceil((unlock.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : 0;
  return { locked, daysLeft, unlockDate: unlock };
}

export default function PartnerEarningsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const { dir } = useDirection();
  const isAr = i18n.language === 'ar';

  const load = useCallback(async (uid: string) => {
    const [rewardsRes, payoutsRes] = await Promise.all([
      (supabase as any).from('rewards').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      (supabase as any).from('payout_requests').select('*').eq('requestor_id', uid).order('requested_at', { ascending: false }),
    ]);
    setRewards(rewardsRes.data || []);
    setPayouts(payoutsRes.data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate('/student-auth'); return; }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, [navigate, load]);

  if (!userId || isLoading) return <DashboardLoading />;

  const pendingRewards = rewards.filter((r) => r.status === 'pending');
  const readyRewards = pendingRewards.filter((r) => !getLockInfo(r.created_at).locked);
  const totalEarnings = rewards.filter((r) => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0);
  const pendingAmount = pendingRewards.reduce((s, r) => s + Number(r.amount), 0);

  const handleRequestPayout = async () => {
    if (!readyRewards.length || !userId) return;
    setRequesting(true);
    try {
      const ids = readyRewards.map((r) => r.id);
      const amount = readyRewards.reduce((s, r) => s + Number(r.amount), 0);
      const { error } = await supabase.rpc('request_payout' as any, {
        p_reward_ids: ids,
        p_amount: amount,
        p_requestor_role: 'influencer',
      });
      if (error) throw error;
      toast({ title: t('influencer.earnings.payoutSuccess', 'Payout requested!') });
      await load(userId);
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error', 'Error'), description: err.message });
    } finally {
      setRequesting(false);
    }
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    rejected: 'bg-red-100 text-red-800',
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" dir={dir}>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <DollarSign className="h-6 w-6 text-primary" />
        {t('partner.earningsTitle', 'My Earnings')}
      </h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs">{t('influencer.earnings.paid', 'Paid Out')}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">₪{totalEarnings.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-xs">{t('influencer.earnings.pending', 'Pending')}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">₪{pendingAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Button */}
      {readyRewards.length > 0 && (
        <Button
          className="w-full gap-2"
          onClick={handleRequestPayout}
          disabled={requesting}
        >
          <Banknote className="h-4 w-4" />
          {requesting
            ? t('common.loading', 'Loading...')
            : `${t('influencer.earnings.requestPayout', 'Request Payout')} (₪${readyRewards.reduce((s, r) => s + Number(r.amount), 0).toLocaleString()})`
          }
        </Button>
      )}

      {/* Pending Locked */}
      {pendingRewards.filter((r) => getLockInfo(r.created_at).locked).length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">{t('influencer.earnings.waitingPeriod', '20-day waiting period')}</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {t('partner.lockInfo', 'Some rewards are locked for {{days}} more days.', {
                  days: Math.max(...pendingRewards.filter((r) => getLockInfo(r.created_at).locked).map((r) => getLockInfo(r.created_at).daysLeft))
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rewards History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('influencer.earnings.earningsHistory', 'Earnings History')}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {rewards.length === 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">{t('influencer.earnings.noEarnings', 'No earnings yet')}</p>
          )}
          {rewards.map((r) => {
            const lock = getLockInfo(r.created_at);
            return (
              <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">₪{Number(r.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(isAr ? 'ar' : 'en-GB')}</p>
                  {r.status === 'pending' && lock.locked && (
                    <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />{lock.daysLeft} {t('influencer.earnings.days', 'days')}
                    </p>
                  )}
                </div>
                <Badge className={`text-xs ${statusColor[r.status] || 'bg-muted text-muted-foreground'}`}>
                  {r.status === 'pending' && !lock.locked
                    ? t('influencer.earnings.ready', 'Ready')
                    : t(`influencer.earnings.${r.status}`, r.status)}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Payout Requests */}
      {payouts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('partner.payoutRequests', 'Payout Requests')}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {payouts.map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">₪{Number(p.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.requested_at).toLocaleDateString(isAr ? 'ar' : 'en-GB')}</p>
                </div>
                <Badge className={`text-xs ${statusColor[p.status] || 'bg-muted text-muted-foreground'}`}>
                  {t(`admin.payouts.statuses.${p.status}`, p.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
