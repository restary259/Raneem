import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, ArrowRight, Mail, Phone, MapPin, Link2, Users,
  CheckCircle, XCircle, DollarSign, Clock, Wallet, Crown,
  FolderCheck, UserPlus,
} from 'lucide-react';
import { ApproveModal, RejectModal, MarkPaidModal } from './PayoutActionModals';
import { toneClasses } from '@/lib/statusTokens';
import LinkedStudentsModal from './LinkedStudentsModal';
import AgentParentToggle from './AgentParentToggle';
import ReferralLinkToggle from './ReferralLinkToggle';
import ApplyFormToggle from './ApplyFormToggle';

import { usePayoutActions } from '@/hooks/usePayoutActions';
import { useDirection } from '@/hooks/useDirection';
import { supabase } from '@/integrations/supabase/client';

export type PayoutRole = 'team_member' | 'agent' | 'social_media_partner' | 'ambassador' | 'student';

export interface DirectoryRow {
  requester_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  city: string | null;
  referral_code?: string | null;
  created_at: string;
  students_count?: number;
  total_earned: number;
  paid_amount: number;
  locked_amount: number;
  available_amount: number;
  open_requests: number;
  open_request_amount: number;
  last_request_at: string | null;
  agent_id?: string | null;
  recruited_count?: number;
  earned_referral?: number;
  earned_override?: number;
  assigned_cases?: number;
  closed_cases?: number;
  team_reward_total?: number;
  referrals_made?: number;
  linked_cases?: number;
}

interface Props {
  role: PayoutRole;
  row: DirectoryRow;
  requests: any[];
  onBack: () => void;
  onRefresh: () => void;
}

const fmt = (n: number) => `${Number(n || 0).toLocaleString('en-US')} ₪`;

/**
 * Role-agnostic requester review surface: the admin picks a requester from a
 * role directory, then approves or pays that requester's payout requests in the
 * context of their earnings and history. Role-specific achievements/network
 * sections render conditionally per role.
 */
const RequesterProfilePanel: React.FC<Props> = ({ role, row, requests, onBack, onRefresh }) => {
  const { t, i18n } = useTranslation('dashboard');
  const { isRtl } = useDirection();
  const { respond } = usePayoutActions();
  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';

  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [studentsModal, setStudentsModal] = useState<string[] | null>(null);
  const [agentId, setAgentId] = useState<string | null>(row.agent_id ?? null);
  const [agentNetwork, setAgentNetwork] = useState<any[]>([]);
  const [referralEnabled, setReferralEnabled] = useState(false);
  const [applyFormEnabled, setApplyFormEnabled] = useState(false);

  const isPartner = role === 'social_media_partner';
  const isAgent = role === 'agent';
  const isTeam = role === 'team_member';
  const isAmbassador = role === 'ambassador';
  const isStudent = role === 'student';
  /** Partners/ambassadors can be assigned a recruiting agent. */
  const hasMemberFeatures = isPartner || isAmbassador;
  /** Partners, ambassadors and agents share the referral-link + apply-form features. */
  const hasFeatureToggles = hasMemberFeatures || isAgent;

  useEffect(() => { setAgentId(row.agent_id ?? null); }, [row.agent_id, row.requester_id]);

  // Fetch the member's two feature flags when the panel opens (admin SELECT
  // on profiles is allowed; the directory RPC does not return these columns).
  useEffect(() => {
    if (!hasFeatureToggles) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('referral_code_enabled, apply_form_enabled')
      .eq('id', row.requester_id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setReferralEnabled(!!data.referral_code_enabled);
        setApplyFormEnabled(!!data.apply_form_enabled);
      });
    return () => { cancelled = true; };
  }, [hasFeatureToggles, row.requester_id]);

  /** An agent's recruited partners/ambassadors (profiles.agent_id = this agent). */
  const loadAgentNetwork = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('profiles')
      .select('id, full_name, email, city, referral_code, created_at')
      .eq('agent_id', row.requester_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setAgentNetwork(data || []);
  }, [row.requester_id]);

  useEffect(() => { if (isAgent) loadAgentNetwork(); }, [isAgent, loadAgentNetwork]);

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
    { label: t('admin.payouts.lifetimeEarned', 'Lifetime earned'), value: fmt(row.total_earned), icon: Wallet, tone: toneClasses('payment').fill },
    { label: t('admin.payouts.colPaid', 'Paid out'), value: fmt(row.paid_amount), icon: CheckCircle, tone: toneClasses('paid').fill },
    { label: t('admin.payouts.colLocked', 'Locked (20d)'), value: fmt(row.locked_amount), icon: Clock, tone: toneClasses('payment').fill },
    { label: t('admin.payouts.colAvailable', 'Available'), value: fmt(row.available_amount), icon: DollarSign, tone: toneClasses('paid').fill },
    ...(isAgent
      ? [{ label: t('admin.payouts.agentOverride', 'Agent override'), value: fmt(Number(row.earned_override || 0)), icon: Crown, tone: toneClasses('payment').fill }]
      : []),
    ...(isTeam
      ? [{ label: t('admin.payouts.teamRewardTotal', 'Team rewards'), value: fmt(Number(row.team_reward_total || 0)), icon: Wallet, tone: toneClasses('submitted').fill }]
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
          {r.payout_reference && (
            <p className="font-mono text-xs text-muted-foreground" dir="ltr">{r.payout_reference}</p>
          )}
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

  const contactSpans: React.ReactNode[] = [
    <span key="email" className="flex items-center gap-2"><Mail className="h-4 w-4" />{row.email}</span>,
  ];
  if (row.phone_number) contactSpans.push(
    <span key="phone" className="flex items-center gap-2"><Phone className="h-4 w-4" />{row.phone_number}</span>,
  );
  if (row.city) contactSpans.push(
    <span key="city" className="flex items-center gap-2"><MapPin className="h-4 w-4" />{row.city}</span>,
  );
  if (row.referral_code && (isPartner || isAmbassador)) contactSpans.push(
    <span key="code" className="flex items-center gap-2"><Link2 className="h-4 w-4" />{row.referral_code}</span>,
  );
  if (isPartner) {
    contactSpans.push(
      <span key="students" className="flex items-center gap-2"><Users className="h-4 w-4" />{row.students_count || 0} {t('admin.payouts.colStudents', 'Students')}</span>,
    );
  }
  if (isAgent) contactSpans.push(
    <span key="recruited" className="flex items-center gap-2"><UserPlus className="h-4 w-4" />{t('admin.payouts.colRecruited', 'Recruited')}: {row.recruited_count || 0}</span>,
  );
  if (isTeam) contactSpans.push(
    <span key="assigned" className="flex items-center gap-2"><FolderCheck className="h-4 w-4" />{t('admin.payouts.assignedCases', 'Assigned cases')}: {row.assigned_cases || 0}</span>,
    <span key="closed" className="flex items-center gap-2"><CheckCircle className="h-4 w-4" />{t('admin.payouts.closedCases', 'Closed cases')}: {row.closed_cases || 0}</span>,
  );
  if (isAmbassador) contactSpans.push(
    <span key="students" className="flex items-center gap-2"><Users className="h-4 w-4" />{row.students_count || 0} {t('admin.payouts.colStudents', 'Students')}</span>,
  );
  if (isStudent) {
    contactSpans.push(
      <span key="referrals" className="flex items-center gap-2"><UserPlus className="h-4 w-4" />{t('admin.payouts.referralsMade', 'Referrals made')}: {row.referrals_made || 0}</span>,
      <span key="linked" className="flex items-center gap-2"><Users className="h-4 w-4" />{t('admin.payouts.linkedCases', 'Linked cases')}: {row.linked_cases || 0}</span>,
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-2" onClick={onBack}>
        {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
        {t('admin.payouts.backToDirectory', 'Back to directory')}
      </Button>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                {row.full_name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isPartner
                  ? t('admin.payouts.partnerSince', 'Partner since')
                  : t('admin.payouts.memberSince', 'Member since')} {new Date(row.created_at).toLocaleDateString(locale)}
              </p>
            </div>
            {row.open_requests > 0 && (
              <Badge variant="secondary">
                {row.open_requests} {t('admin.payouts.openRequests', 'open requests')}
              </Badge>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
            {contactSpans}
          </div>

          {hasFeatureToggles && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{t('admin.features.sectionTitle', 'Features')}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t('admin.features.referralLink', 'Referral link')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.features.referralLinkHint', 'Shows a shareable referral link on the member’s dashboard.')}
                  </p>
                </div>
                <ReferralLinkToggle
                  userId={row.requester_id}
                  userName={row.full_name}
                  value={referralEnabled}
                  onChanged={setReferralEnabled}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t('admin.features.applyForm', 'Built-in apply form')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.features.applyFormHint', 'Adds the Apply page to the member’s dashboard.')}
                  </p>
                </div>
                <ApplyFormToggle
                  userId={row.requester_id}
                  userName={row.full_name}
                  value={applyFormEnabled}
                  onChanged={setApplyFormEnabled}
                />
              </div>
            </div>
          )}

          {hasMemberFeatures && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{t('agent.parentSection', 'Agent (recruiter)')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('agent.parentHint', 'Assigning an agent only routes a flat override from the partner pool on paid cases. Nothing else changes.')}
                </p>
              </div>
              <AgentParentToggle
                recruitId={row.requester_id}
                recruitName={row.full_name}
                currentAgentId={agentId}
                onChanged={(next) => { setAgentId(next); onRefresh(); }}
              />
            </div>
          )}

          {isAgent && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className={`h-4 w-4 ${toneClasses("payment").text}`} />
                  {t('admin.payouts.agentNetwork', 'Agent network')} ({agentNetwork.length.toLocaleString('en-US')})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {agentNetwork.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    {t('admin.payouts.agentNetworkEmpty', 'No recruited partners or ambassadors yet')}
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {agentNetwork.map(n => (
                      <div key={n.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{n.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{n.email}{n.city ? ` · ${n.city}` : ''}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(n.created_at).toLocaleDateString(locale)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isTeam && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderCheck className="h-4 w-4 text-sky-600" />
                  {t('admin.payouts.teamAchievements', 'Case load')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-sky-600"><FolderCheck className="h-5 w-5 text-primary-foreground" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{t('admin.payouts.assignedCases', 'Assigned cases')}</p>
                    <p className="text-lg font-bold">{Number(row.assigned_cases || 0).toLocaleString('en-US')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${toneClasses("paid").fill}`}><CheckCircle className="h-5 w-5 text-primary-foreground" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{t('admin.payouts.closedCases', 'Closed cases')}</p>
                    <p className="text-lg font-bold">{Number(row.closed_cases || 0).toLocaleString('en-US')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isTeam && (
            <TeamEarlyReleaseCard
              memberId={row.requester_id}
              memberName={row.full_name}
              onReleased={onRefresh}
            />
          )}

        </CardContent>
      </Card>

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

export default RequesterProfilePanel;
