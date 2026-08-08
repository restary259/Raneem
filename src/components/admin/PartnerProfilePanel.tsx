import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, ArrowRight, Mail, Phone, MapPin, Link2, Users,
  CheckCircle, XCircle, DollarSign, Clock, Wallet, Crown,
} from 'lucide-react';
import { ApproveModal, RejectModal, MarkPaidModal } from './PayoutActionModals';
import LinkedStudentsModal from './LinkedStudentsModal';
import { usePayoutActions } from '@/hooks/usePayoutActions';
import { useDirection } from '@/hooks/useDirection';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PartnerDirectoryRow {
  partner_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  city: string | null;
  referral_code: string | null;
  created_at: string;
  students_count: number;
  total_earned: number;
  paid_amount: number;
  locked_amount: number;
  available_amount: number;
  open_requests: number;
  open_request_amount: number;
  last_request_at: string | null;
  is_master_partner?: boolean;
  master_partner_name?: string | null;
  recruited_count?: number;
  earned_referral?: number;
  earned_override?: number;
}

interface Props {
  partner: PartnerDirectoryRow;
  requests: any[];
  /** Every partner in the directory — used to attach someone to this network. */
  allPartners?: PartnerDirectoryRow[];
  onBack: () => void;
  onRefresh: () => void;
}

const fmt = (n: number) => `${Number(n || 0).toLocaleString('en-US')} ₪`;

/**
 * Partner-first review surface: the admin picks a partner, then approves or
 * pays that partner's requests in the context of their balance and history.
 */
const PartnerProfilePanel: React.FC<Props> = ({ partner, requests, allPartners = [], onBack, onRefresh }) => {
  const { t, i18n } = useTranslation('dashboard');
  const { isRtl } = useDirection();
  const { respond } = usePayoutActions();
  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';

  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [studentsModal, setStudentsModal] = useState<string[] | null>(null);
  const { toast } = useToast();
  const [isMaster, setIsMaster] = useState(!!partner.is_master_partner);
  const [savingMaster, setSavingMaster] = useState(false);
  const [network, setNetwork] = useState<any[]>([]);

  useEffect(() => { setIsMaster(!!partner.is_master_partner); }, [partner.is_master_partner, partner.partner_id]);

  const loadNetwork = useCallback(async () => {
    if (!isMaster) { setNetwork([]); return; }
    const { data } = await (supabase as any)
      .from('profiles')
      .select('id, full_name, email, city, referral_code, created_at')
      .eq('master_partner_id', partner.partner_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setNetwork(data || []);
  }, [isMaster, partner.partner_id]);

  useEffect(() => { loadNetwork(); }, [loadNetwork]);

  /** Upgrade / downgrade is a pure role flag — earnings, referrals and payout history are untouched. */
  const toggleMaster = async (next: boolean) => {
    setSavingMaster(true);
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ is_master_partner: next })
      .eq('id', partner.partner_id);
    setSavingMaster(false);
    if (error) {
      toast({ variant: 'destructive', title: t('common.actionFailed'), description: error.message });
      return;
    }
    setIsMaster(next);
    onRefresh();
  };

  const open = useMemo(
    () => requests.filter(r => r.status === 'pending' || r.status === 'approved'),
    [requests],
  );
  const history = useMemo(
    () => requests.filter(r => r.status === 'paid' || r.status === 'rejected'),
    [requests],
  );

  const after = async (ok: boolean) => {
    if (ok) onRefresh();
  };

  const kpis = [
    { label: t('admin.payouts.lifetimeEarned', 'Lifetime earned'), value: fmt(partner.total_earned), icon: Wallet, tone: 'bg-primary' },
    { label: t('admin.payouts.colPaid', 'Paid out'), value: fmt(partner.paid_amount), icon: CheckCircle, tone: 'bg-emerald-600' },
    { label: t('admin.payouts.colLocked', 'Locked (20d)'), value: fmt(partner.locked_amount), icon: Clock, tone: 'bg-amber-500' },
    { label: t('admin.payouts.colAvailable', 'Available'), value: fmt(partner.available_amount), icon: DollarSign, tone: 'bg-sky-600' },
    ...(isMaster
      ? [{ label: t('admin.payouts.colOverride', 'Network override'), value: fmt(Number(partner.earned_override || 0)), icon: Crown, tone: 'bg-amber-600' }]
      : []),
  ];

  const StatusBadge = ({ status }: { status: string }) => (
    <Badge variant={status === 'paid' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'}>
      {String(t(`admin.payouts.statuses.${status}`, { defaultValue: status }))}
    </Badge>
  );

  const RequestRow = ({ r }: { r: any }) => (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{fmt(r.amount)}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(r.requested_at).toLocaleDateString(locale)}
            {r.case_references?.length ? ` · ${r.case_references.join(', ')}` : ''}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>

      {r.linked_student_names?.length > 0 && (
        <Button variant="ghost" size="sm" className="text-xs gap-2 h-auto p-1" onClick={() => setStudentsModal(r.linked_student_names)}>
          <Users className="h-3.5 w-3.5" />
          {r.linked_student_names.length} {t('admin.payouts.linkedStudents', 'Students')}
        </Button>
      )}

      {r.status === 'pending' && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setApproveTarget(r)}>
            <CheckCircle className="h-3.5 w-3.5" />{t('admin.payouts.approveBtn', 'Approve')}
          </Button>
          <Button size="sm" variant="destructive" className="gap-2" onClick={() => setRejectTarget(r)}>
            <XCircle className="h-3.5 w-3.5" />{t('admin.payouts.rejectBtn', 'Reject')}
          </Button>
        </div>
      )}
      {r.status === 'approved' && (
        <Button size="sm" className="gap-2" onClick={() => setPayTarget(r)}>
          <DollarSign className="h-3.5 w-3.5" />{t('admin.payouts.markTransferred', 'Mark transferred')}
        </Button>
      )}
      {r.status === 'rejected' && r.reject_reason && (
        <p className="text-xs text-muted-foreground">{r.reject_reason}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-2" onClick={onBack}>
        {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
        {t('admin.payouts.backToDirectory', 'Back to partners')}
      </Button>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                {partner.full_name}
                {isMaster && (
                  <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700">
                    <Crown className="h-3 w-3" />{t('admin.payouts.masterBadge', 'Master')}
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('admin.payouts.partnerSince', 'Partner since')} {new Date(partner.created_at).toLocaleDateString(locale)}
              </p>
            </div>
            {partner.open_requests > 0 && (
              <Badge variant="secondary">
                {partner.open_requests} {t('admin.payouts.openRequests', 'open requests')}
              </Badge>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Mail className="h-4 w-4" />{partner.email}</span>
            {partner.phone_number && <span className="flex items-center gap-2"><Phone className="h-4 w-4" />{partner.phone_number}</span>}
            {partner.city && <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{partner.city}</span>}
            {partner.referral_code && <span className="flex items-center gap-2"><Link2 className="h-4 w-4" />{partner.referral_code}</span>}
            <span className="flex items-center gap-2"><Users className="h-4 w-4" />{partner.students_count} {t('admin.payouts.colStudents', 'Students')}</span>
            {partner.master_partner_name && (
              <span className="flex items-center gap-2"><Crown className="h-4 w-4" />{t('admin.payouts.recruitedBy', 'Recruited by')}: {partner.master_partner_name}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">{t('admin.payouts.masterToggle', 'Master partner')}</p>
              <p className="text-xs text-muted-foreground">
                {t('admin.payouts.masterToggleHint', 'Role upgrade only — earnings, referral code and payout history stay exactly as they are.')}
              </p>
            </div>
            <Switch checked={isMaster} disabled={savingMaster} onCheckedChange={toggleMaster} />
          </div>
        </CardContent>
      </Card>

      {isMaster && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-600" />
              {t('admin.payouts.networkTitle', 'Recruited network')} ({network.length.toLocaleString('en-US')})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 flex flex-wrap items-center gap-2 border-b border-border">
              <Select value="" onValueChange={attachPartner}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={t('admin.payouts.attachPartner', 'Attach a partner to this network')} />
                </SelectTrigger>
                <SelectContent>
                  {attachable.length === 0 ? (
                    <SelectItem value="none" disabled>{t('admin.payouts.noAttachable', 'No available partners')}</SelectItem>
                  ) : attachable.map(p => (
                    <SelectItem key={p.partner_id} value={p.partner_id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {network.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {t('admin.payouts.networkEmpty', 'No recruited partners yet')}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {network.map(n => (
                  <div key={n.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{n.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.email}{n.city ? ` · ${n.city}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString(locale)}
                      </p>
                      <Button variant="ghost" size="sm" onClick={() => detachPartner(n.id)}>
                        {t('admin.payouts.detachPartner', 'Remove')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${k.tone}`}><k.icon className="h-5 w-5 text-primary-foreground" /></div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{k.label}</p>
                <p className="text-lg font-bold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('admin.payouts.openRequestsTitle', 'Open payout requests')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {open.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t('admin.payouts.noOpenRequests', 'No open requests')}</p>
          ) : (
            <div className="divide-y divide-border">{open.map(r => <RequestRow key={r.id} r={r} />)}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('admin.payouts.payoutHistory', 'Payout history')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t('admin.payouts.noRewards')}</p>
          ) : (
            <div className="divide-y divide-border">{history.map(r => <RequestRow key={r.id} r={r} />)}</div>
          )}
        </CardContent>
      </Card>

      <Separator className="opacity-0" />

      <ApproveModal
        open={!!approveTarget}
        onOpenChange={o => { if (!o) setApproveTarget(null); }}
        amount={approveTarget?.amount}
        onConfirm={async (notes: string) => {
          const target = approveTarget;
          setApproveTarget(null);
          if (target) await after(await respond(target.id, 'approve', notes));
        }}
      />
      <RejectModal
        open={!!rejectTarget}
        onOpenChange={o => { if (!o) setRejectTarget(null); }}
        onConfirm={async (reason: string) => {
          const target = rejectTarget;
          setRejectTarget(null);
          if (target) await after(await respond(target.id, 'reject', reason));
        }}
      />
      <MarkPaidModal
        open={!!payTarget}
        onOpenChange={o => { if (!o) setPayTarget(null); }}
        amount={payTarget?.amount}
        onConfirm={async (paymentMethod: string, transactionRef: string, notes: string) => {
          const target = payTarget;
          setPayTarget(null);
          if (!target) return;
          const note = [notes, paymentMethod ? `method: ${paymentMethod}` : ''].filter(Boolean).join(' — ');
          await after(await respond(target.id, 'pay', note, transactionRef));
        }}
      />
      <LinkedStudentsModal
        open={!!studentsModal}
        onOpenChange={o => { if (!o) setStudentsModal(null); }}
        studentNames={studentsModal || []}
      />
    </div>
  );
};

export default PartnerProfilePanel;
