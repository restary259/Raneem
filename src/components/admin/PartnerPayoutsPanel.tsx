import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, DollarSign, CheckCircle2, RefreshCw, Users } from 'lucide-react';
import PasswordVerifyDialog from '@/components/admin/PasswordVerifyDialog';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

/* ─── types ─────────────────────────────────────────────── */
interface RewardRow {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  admin_notes: string | null;
  profiles: { full_name: string; email: string; avatar_url: string | null } | null;
}

interface CaseRow {
  id: string;
  full_name: string;
  source: string;
}

interface PartnerGroup {
  userId: string;
  partnerName: string;
  email: string;
  avatarUrl: string | null;
  pending: RewardRow[];
  paid: RewardRow[];
  caseMap: Record<string, CaseRow>;
}

interface PendingAction {
  type: 'single' | 'bulk';
  partnerId: string;
  partnerName: string;
  rewards: RewardRow[];
  caseMap: Record<string, CaseRow>;
}

/* ─── helpers ───────────────────────────────────────────── */
const parseCaseId = (notes: string | null): string | null => {
  if (!notes) return null;
  const id = notes.replace('Partner commission from case ', '').trim();
  return id.length === 36 ? id : null;
};

const fmt = (n: number) => `₪${n.toLocaleString('en-US')}`;

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

/* ─── PartnerCard ───────────────────────────────────────── */
function PartnerCard({
  group,
  onConfirmSingle,
  onConfirmBulk,
}: {
  group: PartnerGroup;
  onConfirmSingle: (reward: RewardRow) => void;
  onConfirmBulk: (group: PartnerGroup) => void;
}) {
  const { t } = useTranslation('dashboard');
  const [showPaidHistory, setShowPaidHistory] = useState(false);
  const monthStart = startOfMonth();
  const paidThisMonth = group.paid.filter(r => r.paid_at && r.paid_at >= monthStart);
  const pendingTotal = group.pending.reduce((s, r) => s + r.amount, 0);
  const paidMonthTotal = paidThisMonth.reduce((s, r) => s + r.amount, 0);
  const paidAllTotal = group.paid.reduce((s, r) => s + r.amount, 0);
  const initials = group.partnerName
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-0">
      {/* Partner summary card */}
      <Card className="rounded-b-none border-b-0">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start gap-4 justify-between">
            {/* Identity */}
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                {group.avatarUrl && (
                  <img src={group.avatarUrl} alt={group.partnerName} className="object-cover" />
                )}
                <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-foreground">{group.partnerName}</p>
                <p className="text-xs text-muted-foreground">{group.email}</p>
              </div>
            </div>

            {/* Totals */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="text-center">
                <p className="text-lg font-bold text-amber-600">{fmt(pendingTotal)}</p>
                <p className="text-[11px] text-muted-foreground">{t('admin.partnerPayouts.pending')}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{fmt(paidMonthTotal)}</p>
                <p className="text-[11px] text-muted-foreground">{t('admin.partnerPayouts.paidThisMonth')}</p>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-emerald-700">{fmt(paidAllTotal)}</p>
                <p className="text-[11px] text-muted-foreground">{t('admin.partnerPayouts.allTime')}</p>
              </div>
              {group.pending.length > 0 && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onConfirmBulk(group)}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  {t('admin.partnerPayouts.payAllPending', { count: group.pending.length })}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Case breakdown */}
      <Card className="rounded-t-none border-t border-dashed">
        <CardContent className="p-0">
          {/* Pending rows — always expanded */}
          {group.pending.length > 0 && (
            <div className="divide-y divide-border/50">
              {group.pending.map(reward => {
                const caseId = parseCaseId(reward.admin_notes);
                const caseRow = caseId ? group.caseMap[caseId] : null;
                return (
                  <div key={reward.id} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {caseRow?.full_name ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {caseRow?.source ?? ''} · {new Date(reward.created_at).toLocaleDateString('en-US')}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 text-xs font-medium">
                      {t('admin.partnerPayouts.pending')}
                    </Badge>
                    <span className="font-bold text-foreground text-sm">{fmt(reward.amount)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-3"
                      onClick={() => onConfirmSingle(reward)}
                    >
                      <CheckCircle2 className="h-3 w-3 me-1" />
                      {t('admin.partnerPayouts.confirmPayment')}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {group.pending.length === 0 && group.paid.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">
              {t('admin.partnerPayouts.noRewardRows')}
            </p>
          )}

          {/* Paid history — collapsible */}
          {group.paid.length > 0 && (
            <Collapsible open={showPaidHistory} onOpenChange={setShowPaidHistory}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground py-3 border-t border-border/50 hover:bg-muted/30 transition-colors">
                  {showPaidHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showPaidHistory
                    ? t('admin.partnerPayouts.hidePaidHistory', { count: group.paid.length })
                    : t('admin.partnerPayouts.showPaidHistory', { count: group.paid.length })}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="divide-y divide-border/30 border-t border-border/30">
                  {group.paid.map(reward => {
                    const caseId = parseCaseId(reward.admin_notes);
                    const caseRow = caseId ? group.caseMap[caseId] : null;
                    return (
                      <div key={reward.id} className="flex flex-wrap items-center gap-3 px-5 py-3 opacity-75">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {caseRow?.full_name ?? '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {caseRow?.source ?? ''} · {t('admin.partnerPayouts.createdLabel')}: {new Date(reward.created_at).toLocaleDateString('en-US')}
                          </p>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-800 text-xs font-medium">
                          {t('admin.partnerPayouts.paid')}
                        </Badge>
                        <span className="font-bold text-foreground text-sm">{fmt(reward.amount)}</span>
                        {reward.paid_at && (
                          <span className="text-xs text-muted-foreground">
                            {t('admin.partnerPayouts.confirmedLabel')}: {new Date(reward.paid_at).toLocaleDateString('en-US')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── main panel ────────────────────────────────────────── */
export default function PartnerPayoutsPanel() {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [caseMap, setCaseMap] = useState<Record<string, CaseRow>>({});
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // action state
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [showPasswordGate, setShowPasswordGate] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  /* ── fetch ───────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rewardRows, error: rErr } = await (supabase as any)
        .from('rewards')
        .select('id,amount,status,created_at,paid_at,admin_notes,user_id,profiles!inner(full_name,email,avatar_url)')
        .like('admin_notes', 'Partner commission from case%')
        .order('created_at', { ascending: false });

      if (rErr) throw rErr;
      const rows: RewardRow[] = rewardRows || [];
      setRewards(rows);

      const caseIds = [...new Set(rows.map(r => parseCaseId(r.admin_notes)).filter(Boolean))] as string[];
      if (caseIds.length > 0) {
        const { data: caseRows } = await (supabase as any)
          .from('cases')
          .select('id,full_name,source')
          .in('id', caseIds);
        const map: Record<string, CaseRow> = {};
        (caseRows || []).forEach((c: CaseRow) => { map[c.id] = c; });
        setCaseMap(map);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
    fetchData();
  }, [fetchData]);

  // Realtime: refresh when another admin confirms in another tab
  useRealtimeSubscription('rewards', fetchData, true);

  /* ── group rewards by partner ─────────────────────────── */
  const groups = useMemo<PartnerGroup[]>(() => {
    const byPartner: Record<string, PartnerGroup> = {};
    rewards.forEach(r => {
      const uid = r.user_id;
      if (!byPartner[uid]) {
        const profile = r.profiles;
        byPartner[uid] = {
          userId: uid,
          partnerName: profile?.full_name ?? 'Unknown Partner',
          email: profile?.email ?? '',
          avatarUrl: profile?.avatar_url ?? null,
          pending: [],
          paid: [],
          caseMap,
        };
      }
      if (r.status === 'pending') byPartner[uid].pending.push(r);
      else if (r.status === 'paid') byPartner[uid].paid.push(r);
    });
    Object.values(byPartner).forEach(g => { g.caseMap = caseMap; });
    return Object.values(byPartner);
  }, [rewards, caseMap]);

  /* ── confirm flow ─────────────────────────────────────── */
  const triggerConfirm = (action: PendingAction) => {
    setPendingAction(action);
    setShowPasswordGate(true);
  };

  const onPasswordVerified = () => {
    setShowPasswordGate(false);
    setShowConfirmDialog(true);
  };

  const executeConfirm = async () => {
    if (!pendingAction || !currentUserId) return;
    setIsExecuting(true);
    try {
      const now = new Date().toISOString();
      for (const reward of pendingAction.rewards) {
        const caseId = parseCaseId(reward.admin_notes);
        const caseName = caseId ? (pendingAction.caseMap[caseId]?.full_name ?? caseId) : '—';

        const { error: updErr } = await supabase
          .from('rewards')
          .update({ status: 'paid', paid_at: now } as any)
          .eq('id', reward.id);
        if (updErr) throw updErr;

        await supabase.from('admin_audit_log').insert({
          admin_id: currentUserId,
          action: 'partner_payout_confirmed',
          target_id: reward.id,
          target_table: 'rewards',
          details: `Confirmed ${fmt(reward.amount)} to ${pendingAction.partnerName} for case ${caseName} on ${new Date(now).toLocaleDateString('en-US')}`,
        } as any);
      }

      const totalAmount = pendingAction.rewards.reduce((s, r) => s + r.amount, 0);
      toast({
        title: t('admin.partnerPayouts.successTitle'),
        description: t('admin.partnerPayouts.successDesc', {
          amount: fmt(totalAmount),
          partner: pendingAction.partnerName,
        }),
      });

      // Optimistic update
      const confirmedIds = new Set(pendingAction.rewards.map(r => r.id));
      setRewards(prev => prev.map(r =>
        confirmedIds.has(r.id) ? { ...r, status: 'paid', paid_at: now } : r
      ));
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setIsExecuting(false);
      setShowConfirmDialog(false);
      setPendingAction(null);
    }
  };

  /* ── render ──────────────────────────────────────────── */
  const totalPending = useMemo(() => rewards.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0), [rewards]);
  const totalPaid = useMemo(() => rewards.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0), [rewards]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('admin.partnerPayouts.title')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t('admin.partnerPayouts.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-amber-600">{fmt(totalPending)}</p>
            <p className="text-xs text-muted-foreground">{t('admin.partnerPayouts.totalPending')}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-600">{fmt(totalPaid)}</p>
            <p className="text-xs text-muted-foreground">{t('admin.partnerPayouts.totalPaid')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {t('admin.partnerPayouts.refresh')}
          </Button>
        </div>
      </div>

      {/* Partner groups */}
      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t('admin.partnerPayouts.noPartners')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t('admin.partnerPayouts.noPartnersHint')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <PartnerCard
              key={group.userId}
              group={group}
              onConfirmSingle={reward => triggerConfirm({
                type: 'single',
                partnerId: group.userId,
                partnerName: group.partnerName,
                rewards: [reward],
                caseMap: group.caseMap,
              })}
              onConfirmBulk={g => triggerConfirm({
                type: 'bulk',
                partnerId: g.userId,
                partnerName: g.partnerName,
                rewards: g.pending,
                caseMap: g.caseMap,
              })}
            />
          ))}
        </div>
      )}

      {/* Password gate */}
      <PasswordVerifyDialog
        open={showPasswordGate}
        onOpenChange={open => {
          setShowPasswordGate(open);
          if (!open) setPendingAction(null);
        }}
        onVerified={onPasswordVerified}
        title={t('admin.partnerPayouts.passwordTitle')}
        description={t('admin.partnerPayouts.passwordDescription')}
      />

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.partnerPayouts.confirmDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {pendingAction?.type === 'single' ? (
                  <p>
                    {t('admin.partnerPayouts.confirmSingle', {
                      amount: pendingAction.rewards[0].amount.toLocaleString('en-US'),
                      partner: pendingAction.partnerName,
                      student: (() => {
                        const cid = parseCaseId(pendingAction.rewards[0].admin_notes);
                        return cid ? (pendingAction.caseMap[cid]?.full_name ?? cid) : '—';
                      })(),
                    })}
                  </p>
                ) : pendingAction ? (
                  <p>
                    {t('admin.partnerPayouts.confirmBulk', {
                      total: pendingAction.rewards.reduce((s, r) => s + r.amount, 0).toLocaleString('en-US'),
                      partner: pendingAction.partnerName,
                      count: pendingAction.rewards.length,
                    })}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">
                  {t('admin.partnerPayouts.confirmNote')}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExecuting}>
              {t('admin.partnerPayouts.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction disabled={isExecuting} onClick={executeConfirm}>
              {isExecuting
                ? t('admin.partnerPayouts.confirming')
                : t('admin.partnerPayouts.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
