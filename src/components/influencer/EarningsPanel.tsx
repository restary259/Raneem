import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Clock, CheckCircle, XCircle, CreditCard, AlertTriangle, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface EarningsPanelProps { userId: string; role?: 'influencer' | 'lawyer'; }

import { WHATSAPP_SUPPORT_URL } from '@/lib/contactConfig';
const LOCK_DAYS = 20;

const EarningsPanel: React.FC<EarningsPanelProps> = ({ userId, role = 'influencer' }) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const [rewards, setRewards] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [minThreshold, setMinThreshold] = useState(100);
  const [showBankModal, setShowBankModal] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [bankNameInput, setBankNameInput] = useState('');
  const [branchInput, setBranchInput] = useState('');
  const [accountNumberInput, setAccountNumberInput] = useState('');
  const [ibanInput, setIbanInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';

  const safeQuery = async (queryBuilder: any): Promise<{ data: any; error: any }> => {
    try {
      const result = await queryBuilder;
      return result;
    } catch (err) {
      return { data: null, error: err };
    }
  };

  const fetchData = useCallback(async () => {
    const [rewardsRes, requestsRes, configRes, profileRes] = await Promise.all([
      safeQuery((supabase as any).from('rewards').select('*').eq('user_id', userId).order('created_at', { ascending: false })),
      safeQuery((supabase as any).from('payout_requests').select('*').eq('requestor_id', userId).order('requested_at', { ascending: false })),
      safeQuery((supabase as any).from('eligibility_config').select('weight').eq('field_name', 'min_payout_threshold').single()),
      safeQuery((supabase as any).from('profiles').select('full_name, iban, bank_name, iban_confirmed_at, bank_branch, bank_account_number').eq('id', userId).single()),
    ]);
    if (rewardsRes.error) console.error('Rewards fetch failed:', rewardsRes.error);
    if (rewardsRes.data) setRewards(rewardsRes.data);
    if (requestsRes.error) console.error('Payout requests fetch failed:', requestsRes.error);
    if (requestsRes.data) setPayoutRequests(requestsRes.data);
    if (configRes.data) setMinThreshold(configRes.data.weight);
    if (profileRes.data) setProfile(profileRes.data);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useRealtimeSubscription('rewards', fetchData, true);
  useRealtimeSubscription('payout_requests', fetchData, true);

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

  const hasBankDetails = profile?.bank_name && profile?.bank_branch && profile?.bank_account_number && profile?.iban_confirmed_at;

  // MOD-97 IBAN checksum validation
  const validateIBAN = (raw: string): boolean => {
    const iban = raw.replace(/\s/g, '').toUpperCase();
    if (iban.length < 15 || iban.length > 34) return false;
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    const numStr = rearranged.split('').map(c =>
      c >= 'A' ? String(c.charCodeAt(0) - 55) : c
    ).join('');
    let remainder = 0;
    for (const digit of numStr) {
      remainder = (remainder * 10 + parseInt(digit, 10)) % 97;
    }
    return remainder === 1;
  };

  const saveBankDetails = async () => {
    if (!bankNameInput.trim()) {
      toast({ variant: 'destructive', title: t('influencer.earnings.bankNameRequired') });
      return;
    }
    if (!branchInput.trim() || !/^\d{2,4}$/.test(branchInput.trim())) {
      toast({ variant: 'destructive', title: t('influencer.earnings.invalidBranch') });
      return;
    }
    if (!accountNumberInput.trim() || !/^\d{4,12}$/.test(accountNumberInput.trim())) {
      toast({ variant: 'destructive', title: t('influencer.earnings.invalidAccount') });
      return;
    }
    if (ibanInput.trim() && !validateIBAN(ibanInput.trim())) {
      toast({ variant: 'destructive', title: t('influencer.earnings.invalidIban') });
      return;
    }

    const updatePayload: any = {
      bank_name: bankNameInput.trim(),
      bank_branch: branchInput.trim(),
      bank_account_number: accountNumberInput.trim(),
      iban_confirmed_at: new Date().toISOString(),
    };
    if (ibanInput.trim()) updatePayload.iban = ibanInput.trim().replace(/\s/g, '').toUpperCase();

    const { error } = await (supabase as any).from('profiles').update(updatePayload).eq('id', userId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: t('influencer.earnings.bankSaved') });
      setShowBankModal(false);
      fetchData();
    }
  };

  const handleWhatsAppRequest = async () => {
    if (eligibleRewards.length === 0 || availableAmount < minThreshold || submitting) return;
    setSubmitting(true);

    try {
      // Gather student names for the RPC record
      const referralIds = eligibleRewards.map(r => r.referral_id).filter(Boolean);
      let studentNames: string[] = [];
      if (referralIds.length > 0) {
        const { data } = await (supabase as any).from('referrals').select('referred_name').in('id', referralIds);
        if (data) studentNames = data.map((r: any) => r.referred_name);
      }

      const paymentMethod = hasBankDetails
        ? `Bank: ${profile?.bank_name} / Branch: ${profile?.bank_branch} / Account: ${profile?.bank_account_number}`
        : 'Via WhatsApp';

      const { error: rpcError } = await (supabase as any).rpc('request_payout', {
        p_reward_ids: eligibleRewards.map(r => r.id),
        p_amount: availableAmount,
        p_notes: 'Requested via WhatsApp',
        p_payment_method: paymentMethod,
        p_requestor_role: role,
        p_student_names: studentNames,
      });

      if (rpcError) {
        toast({ variant: 'destructive', title: 'Error', description: rpcError.message });
        return;
      }

      const userName = profile?.full_name || t('influencer.earnings.defaultUserName');
      const msgAr = `طلب سحب رصيد | Payout Request\nالاسم: ${userName}\nالمبلغ المستحق: ${availableAmount.toLocaleString('en-US')} ₪\nعدد الطلاب: ${eligibleRewards.length}`;
      const msgEn = `Payout Request\nName: ${userName}\nAmount: ${availableAmount.toLocaleString('en-US')} ₪\nStudents: ${eligibleRewards.length}`;
      const message = i18n.language === 'ar' ? msgAr : msgEn;
      const waUrl = `https://wa.me/message/IVC4VCAEJ6TBD1?text=${encodeURIComponent(message)}`;

      fetchData();

      const win = window.open(waUrl, '_blank');
      if (!win || win.closed) window.location.href = waUrl;

      toast({ title: t('influencer.earnings.requestSubmitted') });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (reqId: string) => {
    const req = payoutRequests.find(r => r.id === reqId);
    if (!req || req.status !== 'pending') return;
    await (supabase as any).from('payout_requests').update({ status: 'rejected', reject_reason: 'Cancelled by user' }).eq('id', reqId);
    if (req.linked_reward_ids?.length) {
      for (const rid of req.linked_reward_ids) {
        await (supabase as any).from('rewards').update({ status: 'pending', payout_requested_at: null }).eq('id', rid);
      }
    }
    toast({ title: t('influencer.earnings.requestCancelled', 'Request cancelled') });
    fetchData();
  };

  const statusColor = (s: string) => s === 'paid' ? 'default' : s === 'rejected' ? 'destructive' : 'secondary';

  const isReady = eligibleRewards.length > 0 && availableAmount >= minThreshold;
  const hasPendingRequest = payoutRequests.some(p => p.status === 'pending');

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-600"><DollarSign className="h-6 w-6 text-white" /></div>
          <div><p className="text-sm text-muted-foreground">{t('influencer.earnings.totalEarnings')}</p><p className="text-2xl font-bold">{totalEarned.toLocaleString('en-US')} ₪</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500"><Clock className="h-6 w-6 text-white" /></div>
          <div><p className="text-sm text-muted-foreground">{t('influencer.earnings.available', 'Available')}</p><p className="text-2xl font-bold">{availableAmount.toLocaleString('en-US')} ₪</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary"><CheckCircle className="h-6 w-6 text-primary-foreground" /></div>
          <div><p className="text-sm text-muted-foreground">{t('influencer.earnings.paid')}</p><p className="text-2xl font-bold">{paidAmount.toLocaleString('en-US')} ₪</p></div>
        </CardContent></Card>
      </div>

      {/* Optional bank details banner */}
      {!hasBankDetails && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{t('influencer.earnings.bankBanner')}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setBankNameInput(profile?.bank_name || ''); setBranchInput(profile?.bank_branch || ''); setAccountNumberInput(profile?.bank_account_number || ''); setIbanInput(profile?.iban || ''); setShowBankModal(true); }}>
            <CreditCard className="h-4 w-4 me-1" />{t('influencer.earnings.bankAdd')}
          </Button>
        </div>
      )}

      {/* Primary action */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleWhatsAppRequest}
          disabled={!isReady || submitting || hasPendingRequest}
          className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white border-0"
        >
          <MessageCircle className="h-4 w-4 me-2" />
          {submitting
            ? t('influencer.earnings.sending')
            : t('influencer.earnings.requestPayoutWA')}
        </Button>

        {hasBankDetails && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => { setBankNameInput(profile?.bank_name || ''); setBranchInput(profile?.bank_branch || ''); setAccountNumberInput(profile?.bank_account_number || ''); setIbanInput(profile?.iban || ''); setShowBankModal(true); }}
          >
            <CreditCard className="h-4 w-4 me-1" />{t('influencer.earnings.editBankDetails')}
          </Button>
        )}

        {hasPendingRequest && (
          <Badge variant="secondary" className="text-xs">⏳ {t('influencer.earnings.requestPending')}</Badge>
        )}
        {!hasPendingRequest && availableAmount > 0 && availableAmount < minThreshold && (
          <Badge variant="secondary" className="text-xs">🔒 {t('influencer.earnings.minThreshold', { amount: minThreshold })}</Badge>
        )}
        {!hasPendingRequest && eligibleRewards.length === 0 && availableAmount === 0 && rewards.length > 0 && (() => {
          const allPaid = rewards.every(r => r.status === 'paid' || r.status === 'cancelled');
          if (allPaid) {
            return <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">✅ {t('influencer.earnings.allReceived')}</Badge>;
          }
          return <Badge variant="secondary" className="text-xs">⏱ {t('influencer.earnings.lockActive')}</Badge>;
        })()}
      </div>

      {/* Payout Requests History */}
      {payoutRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('influencer.earnings.payoutRequests', 'Payout Requests')}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isMobile ? (
              <div className="space-y-3 p-4">
                {payoutRequests.map(r => (
                  <div key={r.id} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{Number(r.amount).toLocaleString('en-US')} ₪</span>
                      <Badge variant={statusColor(r.status) as any}>{String(t(`admin.payouts.statuses.${r.status}`, { defaultValue: r.status }))}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleDateString('en-US')}</p>
                    {r.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => cancelRequest(r.id)}><XCircle className="h-3.5 w-3.5 me-1" />{t('admin.payouts.cancel')}</Button>}
                    {r.status === 'rejected' && r.reject_reason && <p className="text-xs text-destructive">{r.reject_reason}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-semibold">{t('influencer.earnings.amount')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('influencer.earnings.status')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('influencer.earnings.date')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('influencer.earnings.actions', 'Actions')}</th>
                  </tr></thead>
                  <tbody>
                    {payoutRequests.map(r => (
                      <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{Number(r.amount).toLocaleString('en-US')} ₪</td>
                        <td className="px-4 py-3"><Badge variant={statusColor(r.status) as any}>{String(t(`admin.payouts.statuses.${r.status}`, { defaultValue: r.status }))}</Badge></td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(r.requested_at).toLocaleDateString('en-US')}</td>
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

      {/* Israeli Bank Account Modal */}
      <Dialog open={showBankModal} onOpenChange={setShowBankModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('influencer.earnings.bankModalTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('influencer.earnings.bankName')}</Label>
              <Input value={bankNameInput} onChange={e => setBankNameInput(e.target.value)} placeholder="e.g. Bank Hapoalim" className="mt-1" />
            </div>
            <div>
              <Label>{t('influencer.earnings.bankBranch')}</Label>
              <Input value={branchInput} onChange={e => setBranchInput(e.target.value)} placeholder="e.g. 690" dir="ltr" className="mt-1 font-mono" maxLength={4} />
            </div>
            <div>
              <Label>{t('influencer.earnings.bankAccount')}</Label>
              <Input value={accountNumberInput} onChange={e => setAccountNumberInput(e.target.value)} placeholder="e.g. 123456" dir="ltr" className="mt-1 font-mono" maxLength={12} />
            </div>
            <div>
              <Label>{t('influencer.earnings.bankIban')}</Label>
              <Input value={ibanInput} onChange={e => setIbanInput(e.target.value.toUpperCase())} placeholder="IL620108000000099999999" dir="ltr" className="mt-1 font-mono" maxLength={34} />
              <p className="text-xs text-muted-foreground mt-1">{t('influencer.earnings.bankIbanHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBankModal(false)}>{t('influencer.earnings.bankCancel')}</Button>
            <Button onClick={saveBankDetails}>{t('influencer.earnings.bankSaveBtn')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EarningsPanel;
