import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Clock, CheckCircle, Send, Users, XCircle, CreditCard, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';

interface EarningsPanelProps { userId: string; }

const EarningsPanel: React.FC<EarningsPanelProps> = ({ userId }) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const [rewards, setRewards] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [minThreshold, setMinThreshold] = useState(100);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showIbanModal, setShowIbanModal] = useState(false);
  const [requestNotes, setRequestNotes] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [ibanInput, setIbanInput] = useState('');
  const [ibanConfirm, setIbanConfirm] = useState('');
  const [bankNameInput, setBankNameInput] = useState('');
  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
  const isAr = i18n.language === 'ar';

  const LOCK_DAYS = 20;

  const fetchData = async () => {
    const [rewardsRes, requestsRes, configRes, profileRes] = await Promise.all([
      (supabase as any).from('rewards').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      (supabase as any).from('payout_requests').select('*').eq('requestor_id', userId).order('requested_at', { ascending: false }),
      (supabase as any).from('eligibility_config').select('weight').eq('field_name', 'min_payout_threshold').single(),
      (supabase as any).from('profiles').select('iban, bank_name, iban_confirmed_at').eq('id', userId).single(),
    ]);
    if (rewardsRes.data) setRewards(rewardsRes.data);
    if (requestsRes.data) setPayoutRequests(requestsRes.data);
    if (configRes.data) setMinThreshold(configRes.data.weight);
    if (profileRes.data) setProfile(profileRes.data);
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
  const hasIban = profile?.iban && profile?.bank_name && profile?.iban_confirmed_at;
  const canRequest = availableAmount >= minThreshold && hasIban;

  // IBAN validation (basic Israeli/German format)
  const isValidIban = (iban: string) => {
    const cleaned = iban.replace(/\s/g, '').toUpperCase();
    // Israeli IBAN: IL + 2 check + 19 digits = 23 chars
    // German IBAN: DE + 2 check + 18 digits = 22 chars
    return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleaned) && cleaned.length >= 15 && cleaned.length <= 34;
  };

  const saveIban = async () => {
    const cleaned = ibanInput.replace(/\s/g, '').toUpperCase();
    if (!isValidIban(cleaned)) {
      toast({ variant: 'destructive', title: isAr ? 'رقم IBAN غير صالح' : 'Invalid IBAN format' });
      return;
    }
    if (cleaned !== ibanConfirm.replace(/\s/g, '').toUpperCase()) {
      toast({ variant: 'destructive', title: isAr ? 'أرقام IBAN غير متطابقة' : 'IBAN numbers do not match' });
      return;
    }
    if (!bankNameInput.trim()) {
      toast({ variant: 'destructive', title: isAr ? 'يرجى إدخال اسم البنك' : 'Please enter bank name' });
      return;
    }

    const { error } = await (supabase as any).from('profiles').update({
      iban: cleaned,
      bank_name: bankNameInput.trim(),
      iban_confirmed_at: new Date().toISOString(),
    }).eq('id', userId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: isAr ? 'تم حفظ بيانات البنك' : 'Bank details saved' });
      setShowIbanModal(false);
      fetchData();
    }
  };

  const handleRequestPayout = () => {
    if (!hasIban) {
      setIbanInput(profile?.iban || '');
      setIbanConfirm('');
      setBankNameInput(profile?.bank_name || '');
      setShowIbanModal(true);
      return;
    }
    setShowRequestModal(true);
  };

  const submitPayoutRequest = async () => {
    if (!canRequest) return;
    const referralIds = eligibleRewards.map(r => r.referral_id).filter(Boolean);
    let studentNames: string[] = [];
    if (referralIds.length > 0) {
      const { data } = await (supabase as any).from('referrals').select('referred_name').in('id', referralIds);
      if (data) studentNames = data.map((r: any) => r.referred_name);
    }
    await (supabase as any).from('payout_requests').insert({
      requestor_id: userId,
      requestor_role: 'influencer',
      linked_reward_ids: eligibleRewards.map(r => r.id),
      linked_student_names: studentNames,
      amount: availableAmount,
      admin_notes: requestNotes || null,
      payment_method: `IBAN: ${profile?.iban} / ${profile?.bank_name}`,
    });
    for (const r of eligibleRewards) {
      await (supabase as any).from('rewards').update({ status: 'approved', payout_requested_at: new Date().toISOString() }).eq('id', r.id);
    }
    toast({ title: t('influencer.earnings.payoutSuccess', 'Payout request submitted!') });
    setShowRequestModal(false);
    setRequestNotes('');
    fetchData();
    const whatsappUrl = 'https://api.whatsapp.com/message/IVC4VCAEJ6TBD1';
    const win = window.open(whatsappUrl, '_blank');
    if (!win || win.closed) {
      window.location.href = whatsappUrl;
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

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-600"><DollarSign className="h-6 w-6 text-white" /></div>
          <div><p className="text-sm text-muted-foreground">{t('influencer.earnings.totalEarnings')}</p><p className="text-2xl font-bold">{totalEarned.toLocaleString()} ₪</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500"><Clock className="h-6 w-6 text-white" /></div>
          <div><p className="text-sm text-muted-foreground">{t('influencer.earnings.available', 'Available')}</p><p className="text-2xl font-bold">{availableAmount.toLocaleString()} ₪</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-[hsl(var(--primary))]"><CheckCircle className="h-6 w-6 text-white" /></div>
          <div><p className="text-sm text-muted-foreground">{t('influencer.earnings.paid')}</p><p className="text-2xl font-bold">{paidAmount.toLocaleString()} ₪</p></div>
        </CardContent></Card>
      </div>

      {/* IBAN Status Banner */}
      {!hasIban && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{isAr ? 'يرجى إضافة بيانات البنك لطلب الدفع' : 'Add bank details to request payouts'}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setIbanInput(profile?.iban || ''); setIbanConfirm(''); setBankNameInput(profile?.bank_name || ''); setShowIbanModal(true); }}>
            <CreditCard className="h-4 w-4 me-1" />{isAr ? 'إضافة' : 'Add'}
          </Button>
        </div>
      )}

      {/* Request Payout */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleRequestPayout} disabled={availableAmount < minThreshold} className="w-full sm:w-auto">
          <Send className="h-4 w-4 me-2" />{t('influencer.earnings.requestPayout')}
        </Button>
        {availableAmount > 0 && availableAmount < minThreshold && (
          <Badge variant="secondary" className="text-xs">🔒 {t('influencer.earnings.minThreshold', { amount: minThreshold })}</Badge>
        )}
      </div>

      {/* Payout Requests Table */}
      {payoutRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('influencer.earnings.payoutRequests', 'Payout Requests')}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isMobile ? (
              <div className="space-y-3 p-4">
                {payoutRequests.map(r => (
                  <div key={r.id} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{Number(r.amount).toLocaleString()} ₪</span>
                      <Badge variant={statusColor(r.status) as any}>{String(t(`admin.payouts.statuses.${r.status}`, { defaultValue: r.status }))}</Badge>
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
                    <th className="px-4 py-3 text-start font-semibold">{t('influencer.earnings.amount')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('influencer.earnings.status')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('influencer.earnings.date')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('influencer.earnings.actions', 'Actions')}</th>
                  </tr></thead>
                  <tbody>
                    {payoutRequests.map(r => (
                      <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{Number(r.amount).toLocaleString()} ₪</td>
                        <td className="px-4 py-3"><Badge variant={statusColor(r.status) as any}>{String(t(`admin.payouts.statuses.${r.status}`, { defaultValue: r.status }))}</Badge></td>
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

      {/* Request Payout Modal */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('influencer.earnings.requestPayout')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">{t('influencer.earnings.linkedRewards', 'Eligible rewards')}: <strong>{eligibleRewards.length}</strong></p>
            <p className="text-sm">{t('influencer.earnings.totalAmount', 'Total amount')}: <strong>{availableAmount.toLocaleString()} ₪</strong></p>
            <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
              <p><strong>{isAr ? 'البنك:' : 'Bank:'}</strong> {profile?.bank_name}</p>
              <p><strong>IBAN:</strong> {profile?.iban?.replace(/(.{4})/g, '$1 ')}</p>
            </div>
            <div>
              <Label>{t('admin.payouts.notesOptional', 'Notes (optional)')}</Label>
              <Textarea value={requestNotes} onChange={e => setRequestNotes(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestModal(false)}>{t('admin.shared.cancelBtn', 'Cancel')}</Button>
            <Button onClick={submitPayoutRequest}>{t('influencer.earnings.confirm', 'Confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IBAN Entry Modal */}
      <Dialog open={showIbanModal} onOpenChange={setShowIbanModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isAr ? 'بيانات الحساب البنكي' : 'Bank Account Details'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isAr ? 'اسم البنك' : 'Bank Name'}</Label>
              <Input value={bankNameInput} onChange={e => setBankNameInput(e.target.value)} placeholder={isAr ? 'مثال: بنك هبوعليم' : 'e.g. Bank Hapoalim'} className="mt-1" />
            </div>
            <div>
              <Label>IBAN</Label>
              <Input value={ibanInput} onChange={e => setIbanInput(e.target.value)} placeholder="IL00 0000 0000 0000 0000 000" dir="ltr" className="mt-1 font-mono" />
            </div>
            <div>
              <Label>{isAr ? 'تأكيد IBAN' : 'Confirm IBAN'}</Label>
              <Input value={ibanConfirm} onChange={e => setIbanConfirm(e.target.value)} placeholder={isAr ? 'أعد إدخال IBAN' : 'Re-enter IBAN'} dir="ltr" className="mt-1 font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIbanModal(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={saveIban}>{isAr ? 'حفظ' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EarningsPanel;
