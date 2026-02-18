import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Gift, Trophy, Award, Star, Clock, CheckCircle, Send, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';

interface RewardsPanelProps { userId: string; }

const RewardsPanel: React.FC<RewardsPanelProps> = ({ userId }) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const [rewards, setRewards] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [minThreshold, setMinThreshold] = useState(100);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestNotes, setRequestNotes] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [ibanInput, setIbanInput] = useState('');
  const [savingIban, setSavingIban] = useState(false);
  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
  const LOCK_DAYS = 20;

  const MILESTONE_ICONS: Record<string, React.ReactNode> = {
    first_referral: <Star className="h-5 w-5 text-amber-500" />,
    '5_referrals': <Award className="h-5 w-5 text-blue-500" />,
    '10_referrals': <Trophy className="h-5 w-5 text-purple-500" />,
  };

  const safeQuery = (p: Promise<any>) => p.catch(err => ({ data: null, error: err }));

  const fetchData = async () => {
    const [rewardsRes, milestonesRes, requestsRes, configRes, profileRes] = await Promise.all([
      safeQuery((supabase as any).from('rewards').select('*').eq('user_id', userId).order('created_at', { ascending: false })),
      safeQuery((supabase as any).from('referral_milestones').select('*').eq('user_id', userId)),
      safeQuery((supabase as any).from('payout_requests').select('*').eq('requestor_id', userId).order('requested_at', { ascending: false })),
      safeQuery((supabase as any).from('eligibility_config').select('weight').eq('field_name', 'min_payout_threshold').single()),
      safeQuery((supabase as any).from('profiles').select('iban, iban_confirmed_at').eq('id', userId).maybeSingle()),
    ]);
    if (rewardsRes.error) console.error('Rewards fetch failed:', rewardsRes.error);
    if (rewardsRes.data) setRewards(rewardsRes.data);
    if (milestonesRes.data) setMilestones(milestonesRes.data);
    if (requestsRes.error) console.error('Payout requests fetch failed:', requestsRes.error);
    if (requestsRes.data) setPayoutRequests(requestsRes.data);
    if (configRes.data) setMinThreshold(configRes.data.weight);
    if (profileRes.data) { setProfile(profileRes.data); setIbanInput(profileRes.data.iban || ''); }
  };

  useEffect(() => { fetchData(); }, [userId]);

  const totalEarned = rewards.reduce((s, r) => s + Number(r.amount || 0), 0);
  const paidAmount = rewards.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount || 0), 0);

  const requestedRewardIds = new Set(payoutRequests.filter(p => p.status !== 'rejected').flatMap((p: any) => p.linked_reward_ids || []));
  const eligibleRewards = rewards.filter(r => {
    if (r.status !== 'pending') return false;
    if (requestedRewardIds.has(r.id)) return false;
    const days = Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return days >= LOCK_DAYS;
  });
  const availableAmount = eligibleRewards.reduce((s, r) => s + Number(r.amount || 0), 0);
  const hasIban = !!profile?.iban && profile.iban.length >= 15;
  const canRequest = availableAmount >= minThreshold && hasIban;

  const saveIban = async () => {
    const trimmed = ibanInput.trim().replace(/\s/g, '');
    if (trimmed.length < 15 || !/^[A-Z]{2}\d{2}/.test(trimmed.toUpperCase())) {
      toast({ variant: 'destructive', title: t('rewards.invalidIban', 'Invalid IBAN'), description: t('rewards.ibanFormatHint', 'Please enter a valid IBAN (e.g. DE89370400440532013000)') });
      return;
    }
    setSavingIban(true);
    const { error } = await (supabase as any).from('profiles').update({ iban: trimmed.toUpperCase(), iban_confirmed_at: new Date().toISOString() }).eq('id', userId);
    setSavingIban(false);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); return; }
    toast({ title: t('rewards.ibanSaved', 'IBAN saved') });
    fetchData();
  };

  const submitPayoutRequest = async () => {
    if (!canRequest) return;
    const referralIds = eligibleRewards.map(r => r.referral_id).filter(Boolean);
    let studentNames: string[] = [];
    if (referralIds.length > 0) {
      const { data } = await (supabase as any).from('referrals').select('referred_name').in('id', referralIds);
      if (data) studentNames = data.map((r: any) => r.referred_name);
    }
    const { error: insertError } = await (supabase as any).from('payout_requests').insert({
      requestor_id: userId, requestor_role: 'student',
      linked_reward_ids: eligibleRewards.map(r => r.id),
      linked_student_names: studentNames, amount: availableAmount,
      admin_notes: requestNotes || null
    });
    if (insertError) {
      toast({ variant: 'destructive', title: t('common.error'), description: insertError.message });
      return;
    }
    for (const r of eligibleRewards) {
      await (supabase as any).from('rewards').update({ status: 'approved', payout_requested_at: new Date().toISOString() }).eq('id', r.id);
    }
    toast({ title: t('rewards.payoutRequested') });
    setShowRequestModal(false);
    setRequestNotes('');
    fetchData();
  };

  const cancelRequest = async (reqId: string) => {
    const req = payoutRequests.find(r => r.id === reqId);
    if (!req || req.status !== 'pending') return;
    const { error: cancelError } = await (supabase as any).from('payout_requests').update({ status: 'rejected', reject_reason: 'Cancelled by user' }).eq('id', reqId);
    if (cancelError) {
      toast({ variant: 'destructive', title: t('common.error'), description: cancelError.message });
      return;
    }
    if (req.linked_reward_ids?.length) {
      for (const rid of req.linked_reward_ids) {
        await (supabase as any).from('rewards').update({ status: 'pending', payout_requested_at: null }).eq('id', rid);
      }
    }
    toast({ title: t('rewards.requestCancelled', 'Request cancelled') });
    fetchData();
  };

  const statusColor = (s: string) => s === 'paid' ? 'default' : s === 'rejected' ? 'destructive' : 'secondary';

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-600"><Gift className="h-6 w-6 text-white" /></div>
          <div><p className="text-sm text-muted-foreground">{t('rewards.totalRewards')}</p><p className="text-2xl font-bold">{totalEarned.toLocaleString()} ₪</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500"><Clock className="h-6 w-6 text-white" /></div>
          <div><p className="text-sm text-muted-foreground">{t('rewards.available', 'Available')}</p><p className="text-2xl font-bold">{availableAmount.toLocaleString()} ₪</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-[hsl(var(--primary))]"><CheckCircle className="h-6 w-6 text-white" /></div>
          <div><p className="text-sm text-muted-foreground">{t('rewards.paid')}</p><p className="text-2xl font-bold">{paidAmount.toLocaleString()} ₪</p></div>
        </CardContent></Card>
      </div>

      {/* IBAN Entry */}
      {!hasIban && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-amber-800">🏦 {t('rewards.ibanRequired', 'Bank IBAN required before requesting payouts')}</p>
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">{t('rewards.ibanLabel', 'IBAN')}</Label>
                <Input value={ibanInput} onChange={e => setIbanInput(e.target.value)} placeholder="DE89 3704 0044 0532 0130 00" className="mt-1 font-mono" />
              </div>
              <Button size="sm" onClick={saveIban} disabled={savingIban}>{savingIban ? '...' : t('rewards.saveIban', 'Save IBAN')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request Payout */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setShowRequestModal(true)} disabled={!canRequest} className="w-full sm:w-auto">
          <Send className="h-4 w-4 me-2" />{t('rewards.requestPayout')}
        </Button>
        {!hasIban && availableAmount >= minThreshold && (
          <Badge variant="secondary" className="text-xs">🏦 {t('rewards.addIbanFirst', 'Add IBAN first')}</Badge>
        )}
        {hasIban && !canRequest && availableAmount > 0 && availableAmount < minThreshold && (
          <Badge variant="secondary" className="text-xs">🔒 {t('rewards.minThreshold', { defaultValue: `Minimum ${minThreshold} ₪`, amount: minThreshold })}</Badge>
        )}
      </div>

      {/* Milestones */}
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

      {/* Payout Requests */}
      {payoutRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('rewards.payoutRequests', 'Payout Requests')}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isMobile ? (
              <div className="space-y-3 p-4">
                {payoutRequests.map(r => (
                  <div key={r.id} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{Number(r.amount).toLocaleString()} ₪</span>
                      <Badge variant={statusColor(r.status) as any}>{String(t(`rewards.statuses.${r.status}`, { defaultValue: r.status }))}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleDateString(locale)}</p>
                    {r.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => cancelRequest(r.id)}><XCircle className="h-3.5 w-3.5 me-1" />{t('admin.payouts.cancel')}</Button>}
                    {r.status === 'rejected' && r.reject_reason && <p className="text-xs text-destructive">{r.reject_reason}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-semibold">{t('rewards.amountCol')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('rewards.statusCol')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('rewards.dateCol')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('rewards.actions', 'Actions')}</th>
                  </tr></thead>
                  <tbody>
                    {payoutRequests.map(r => (
                      <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{Number(r.amount).toLocaleString()} ₪</td>
                        <td className="px-4 py-3"><Badge variant={statusColor(r.status) as any}>{String(t(`rewards.statuses.${r.status}`, { defaultValue: r.status }))}</Badge></td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(r.requested_at).toLocaleDateString(locale)}</td>
                        <td className="px-4 py-3">
                          {r.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => cancelRequest(r.id)}><XCircle className="h-3.5 w-3.5 me-1" />{t('admin.payouts.cancel')}</Button>}
                          {r.status === 'rejected' && r.reject_reason && <span className="text-xs text-destructive">{r.reject_reason}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rewards History */}
      <Card>
        <CardHeader><CardTitle className="text-lg">{t('rewards.rewardsHistory')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rewards.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">{t('rewards.noRewards')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start font-semibold">{t('rewards.amountCol')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('rewards.statusCol')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('rewards.dateCol')}</th>
                </tr></thead>
                <tbody>
                  {rewards.map(r => (
                    <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{Number(r.amount).toLocaleString()} ₪</td>
                      <td className="px-4 py-3"><Badge variant={statusColor(r.status) as any}>{String(t(`rewards.statuses.${r.status}`, { defaultValue: r.status }))}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString(locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('rewards.requestPayout')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">{t('rewards.eligibleCount', 'Eligible rewards')}: <strong>{eligibleRewards.length}</strong></p>
            <p className="text-sm">{t('rewards.totalAmount', 'Total')}: <strong>{availableAmount.toLocaleString()} ₪</strong></p>
            <div>
              <Label>{t('admin.payouts.notesOptional', 'Notes (optional)')}</Label>
              <Textarea value={requestNotes} onChange={e => setRequestNotes(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestModal(false)}>{t('admin.shared.cancelBtn', 'Cancel')}</Button>
            <Button onClick={submitPayoutRequest}>{t('rewards.confirm', 'Confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RewardsPanel;
