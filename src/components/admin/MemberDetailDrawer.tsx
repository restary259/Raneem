import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { formatILS } from "@/lib/money";
import { Shield, Handshake, UserCheck, Users, Crown, DollarSign, Award, Network, Trash2, Banknote, Landmark } from "lucide-react";
import AgentInviteToggle from "./AgentInviteToggle";
import AgentCreateAccountsToggle from "./AgentCreateAccountsToggle";
import DeactivateAccountDialog, { type DeactivateTarget } from "./DeactivateAccountDialog";
import { cn } from "@/lib/utils";

interface MemberDetailDrawerProps {
  member: import("./MemberList").MemberRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommissionBreakdown {
  totalEarned: number;
  paid: number;
  pending: number;
  byType: Record<string, number>;
  rateChanges: Array<{
    entity_type: string;
    rate_kind: string;
    old_value: number;
    new_value: number;
    changed_by: string | null;
    changed_at: string;
    reason: string | null;
  }>;
}

interface PanelSlot {
  Header: React.ElementType;
  Title: React.ElementType;
  Description: React.ElementType;
  Close: React.ElementType;
}

interface PanelProps {
  member: import("./MemberList").MemberRow;
  breakdown: CommissionBreakdown | null;
  loadingBreakdown: boolean;
  primaryStats: Array<{ label: string; value: string; icon: React.ComponentType<{ className?: string }> }>;
  commissionStats: Array<{ label: string; value: string }>;
  roleLabel: string;
  RoleIcon: React.ComponentType<{ className?: string }>;
  t: TFunction;
  onOpenChange: (open: boolean) => void;
  deactivateTarget: DeactivateTarget | null;
  setDeactivateTarget: React.Dispatch<React.SetStateAction<DeactivateTarget | null>>;
  slots: PanelSlot;
  bodyClassName: string;
}

function MemberDetailPanel({
  member,
  breakdown,
  loadingBreakdown,
  primaryStats,
  commissionStats,
  roleLabel,
  RoleIcon,
  t,
  onOpenChange,
  deactivateTarget,
  setDeactivateTarget,
  slots,
  bodyClassName,
}: PanelProps) {
  const { Header, Title, Description, Close } = slots;

  return (
    <>
      <Header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b">
        <div className="flex items-center gap-3">
          <Close className="shrink-0" asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </Close>
          <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
            <RoleIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <Title className="flex items-center gap-2">
              {member.full_name}
              <Badge variant="secondary" className="text-xs gap-1">
                <RoleIcon className="h-3 w-3" />
                {roleLabel}
              </Badge>
            </Title>
            <Description className="flex items-center gap-2 text-xs">
              {member.email}
              {member.phone_number && (
                <>
                  <span className="text-muted-foreground">·</span>
                  {member.phone_number}
                </>
              )}
            </Description>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={member.is_deactivated ? "destructive" : "outline"} className="gap-1">
            {member.is_deactivated ? (
              <>
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
                {t("admin.members.statusDeactivated", "Deactivated")}
              </>
            ) : (
              <>
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="M22 4L12 14.01l-3-3" />
                </svg>
                {t("admin.members.statusActive", "Active")}
              </>
            )}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setDeactivateTarget({
                id: member.requester_id,
                full_name: member.full_name,
                email: member.email,
                roleLabel,
              })
            }
          >
            <Trash2 className="h-4 w-4" />
            {t("admin.members.deactivate", "Deactivate")}
          </Button>
        </div>
      </Header>

      <div className={bodyClassName}>
        {/* Primary KPIs */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              {t("admin.members.sectionPerformance", "Performance")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {primaryStats.map((stat, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t(stat.label)}</span>
                  </div>
                  <div className="text-lg font-bold tabular-nums">{stat.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Commission Breakdown */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              {t("admin.members.sectionCommission", "Commission")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {commissionStats.map((stat, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-1">{t(stat.label)}</div>
                  <div className="text-lg font-bold tabular-nums">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Detailed breakdown from RPC */}
            {loadingBreakdown ? (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : breakdown ? (
              <div className="mt-4 space-y-3">
                <Separator />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("admin.members.commissionByType", "By Reward Type")}
                </h4>
                <div className="space-y-2">
                  {Object.entries(breakdown.byType || {}).map(([type, amount]) => (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground capitalize">{type.replace(/_/g, " ")}</span>
                      <span className="font-mono tabular-nums">{formatILS(amount)}</span>
                    </div>
                  ))}
                </div>

                {breakdown.rateChanges && breakdown.rateChanges.length > 0 && (
                  <>
                    <Separator />
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("admin.members.recentRateChanges", "Recent Rate Changes")}
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {breakdown.rateChanges.slice(0, 8).map((change) => (
                        <div
                          key={change.changed_at}
                          className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card text-xs flex-wrap"
                        >
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {change.entity_type}
                          </Badge>
                          <span className="text-muted-foreground">{change.rate_kind}</span>
                          <span className="font-mono">
                            {formatILS(change.old_value)} →{" "}
                            <span className="text-primary font-semibold">{formatILS(change.new_value)}</span>
                          </span>
                          {change.reason && (
                            <span className="text-[10px] text-muted-foreground italic">“{change.reason}”</span>
                          )}
                          <span className="ms-auto text-[10px] text-muted-foreground">
                            {new Date(change.changed_at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-4 text-center text-sm text-muted-foreground py-3">
                {t("admin.members.noCommissionData", "No commission data available")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cash Collection Debts — team members only */}
        {member.role === "team_member" && (
          <CashDebtsCard teamMemberId={member.requester_id} t={t} />
        )}

        {/* Role-specific Actions */}
        {member.role === "agent" && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                {t("admin.members.sectionActions", "Actions")}
              </h3>
              <div className="space-y-3">
                <AgentInviteToggle
                  agentId={member.requester_id}
                  agentName={member.full_name}
                  canInvite={false}
                  onChanged={() => {}}
                  variant="plain"
                />
                <AgentCreateAccountsToggle
                  agentId={member.requester_id}
                  agentName={member.full_name}
                  canCreateAccounts={false}
                  onChanged={() => {}}
                  variant="plain"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Meta info */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              {t("admin.members.sectionInfo", "Account Info")}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("admin.members.joined", "Joined")}</span>
                <span className="font-mono">{new Date(member.created_at).toLocaleDateString()}</span>
              </div>
              {member.referral_code && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("admin.members.referralCode", "Referral Code")}</span>
                  <span className="font-mono bg-muted px-2 py-0.5 rounded">{member.referral_code}</span>
                </div>
              )}
              {member.agent_id && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("admin.members.agentId", "Agent ID")}</span>
                  <span className="font-mono text-xs">{member.agent_id.slice(0, 8)}…</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <DeactivateAccountDialog
        target={deactivateTarget}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
        onDone={() => {
          setDeactivateTarget(null);
          onOpenChange(false);
        }}
      />
    </>
  );
}

interface CashDebt {
  payment_id: string;
  case_id: string;
  case_reference: string | null;
  student_name: string;
  amount_owed_to_admin: number;
  debt_status: string;
}

function CashDebtsCard({ teamMemberId, t }: { teamMemberId: string; t: TFunction }) {
  const [debts, setDebts] = useState<CashDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("v_cash_debts")
        .select("payment_id, case_id, case_reference, student_name, amount_owed_to_admin, debt_status")
        .eq("team_member_id", teamMemberId)
        .eq("debt_status", "pending");
      setDebts(data ?? []);
    } catch {
      setDebts([]);
    } finally {
      setLoading(false);
    }
  }, [teamMemberId]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const handleSettle = async (caseId: string) => {
    setSettlingId(caseId);
    try {
      const { error } = await supabase.rpc("settle_cash_collection", { p_case_id: caseId });
      if (error) throw error;
      await fetchDebts();
    } catch (err) {
      console.error("Failed to settle cash collection:", err);
    } finally {
      setSettlingId(null);
    }
  };

  const total = debts.reduce((sum, d) => sum + Number(d.amount_owed_to_admin ?? 0), 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (debts.length === 0) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-amber-700">
            {t("admin.members.cashDebtTitle", "Cash Collection Debts")}
          </h3>
          <Badge variant="outline" className="ml-auto text-amber-700 border-amber-500/40">
            {debts.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("admin.members.cashDebtHint", "Pending cash collections this member owes to DARB (service fee minus commission).")}
        </p>
        <div className="text-xl font-bold tabular-nums text-amber-700">
          {formatILS(total)}
        </div>
        <div className="space-y-2">
          {debts.map((d) => (
            <div
              key={d.payment_id}
              className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-card text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{d.student_name}</div>
                {d.case_reference && (
                  <div className="text-xs text-muted-foreground font-mono">{d.case_reference}</div>
                )}
              </div>
              <span className="font-mono tabular-nums text-sm whitespace-nowrap">
                {formatILS(d.amount_owed_to_admin)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                disabled={settlingId === d.case_id}
                onClick={() => handleSettle(d.case_id)}
              >
                <Landmark className="h-3.5 w-3.5" />
                {settlingId === d.case_id
                  ? t("admin.members.settling", "Settling…")
                  : t("admin.members.settle", "Settle")}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MemberDetailDrawer({ member, open, onOpenChange }: MemberDetailDrawerProps) {
  const { t } = useTranslation("dashboard");
  const isMobile = useIsMobile();
  const [breakdown, setBreakdown] = useState<CommissionBreakdown | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<DeactivateTarget | null>(null);

  const loadBreakdown = useCallback(async (id: string) => {
    setLoadingBreakdown(true);
    try {
      const { data, error } = await supabase.rpc("get_account_commission_history", {
        p_user_id: id,
      });
      if (error) throw error;
      setBreakdown(data as unknown as CommissionBreakdown);
    } catch (err) {
      console.error("Failed to load commission breakdown:", err);
      setBreakdown(null);
    } finally {
      setLoadingBreakdown(false);
    }
  }, []);

  useEffect(() => {
    if (member?.requester_id) {
      loadBreakdown(member.requester_id);
    } else {
      setBreakdown(null);
    }
  }, [member?.requester_id, loadBreakdown]);

  useEffect(() => {
    if (!open) setDeactivateTarget(null);
  }, [open]);

  if (!member) return null;

  const RoleIcon = {
    team_member: Users,
    agent: Shield,
    social_media_partner: Handshake,
    ambassador: UserCheck,
  }[member.role] || Users;

  const roleLabel = t({
    team_member: "admin.members.roleTeamMember",
    agent: "admin.members.roleAgent",
    social_media_partner: "admin.members.rolePartner",
    ambassador: "admin.members.roleAmbassador",
  }[member.role] || member.role);

  const primaryStats = (() => {
    switch (member.role) {
      case "team_member":
        return [
          { label: t("admin.members.kpiAssigned", "Assigned Cases"), value: String(member.assigned_cases), icon: Users },
          { label: t("admin.members.kpiEnrolled", "Enrolled"), value: String(member.enrolled_cases), icon: Award },
          { label: t("admin.members.kpiCommissionRate", "Commission / Enrolled"), value: formatILS(member.team_reward_total), icon: DollarSign },
        ];
      case "agent":
        return [
          { label: t("admin.members.kpiRecruits", "Recruits"), value: String(member.recruited_count), icon: Users },
          { label: t("admin.members.kpiDirectEnrolled", "Direct Enrolled"), value: String(member.enrolled_cases || 0), icon: Award },
          { label: t("admin.members.kpiNetworkEnrolled", "Network Enrolled"), value: String(member.enrolled_cases || 0), icon: Network },
          { label: t("admin.members.kpiOverrideEarned", "Override Earned"), value: formatILS(member.earned_override), icon: Crown },
        ];
      case "social_media_partner":
      case "ambassador":
        return [
          { label: t("admin.members.kpiReferred", "Referred"), value: String(member.students_count), icon: Users },
          { label: t("admin.members.kpiEnrolled", "Enrolled"), value: String(member.students_count > 0 ? Math.round(member.students_count * 0.3) : 0), icon: Award },
          { label: t("admin.members.kpiEarnedReferral", "Earned (Referral)"), value: formatILS(member.earned_referral), icon: DollarSign },
        ];
      default:
        return [];
    }
  })();

  const commissionStats = [
    { label: t("admin.members.kpiTotalEarned", "Total Earned"), value: formatILS(member.total_earned) },
    { label: t("admin.members.kpiPaid", "Paid Out"), value: formatILS(member.paid_amount) },
    { label: t("admin.members.kpiPending", "Pending (20-day hold)"), value: formatILS(member.locked_amount) },
    { label: t("admin.members.kpiAvailable", "Available for Payout"), value: formatILS(member.available_amount) },
  ];

  const panelProps = {
    member,
    breakdown,
    loadingBreakdown,
    primaryStats,
    commissionStats,
    roleLabel,
    RoleIcon,
    t,
    onOpenChange,
    deactivateTarget,
    setDeactivateTarget,
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="right">
        <DrawerContent className="w-full sm:max-w-2xl lg:max-w-3xl">
          <MemberDetailPanel
            {...panelProps}
            slots={{ Header: DrawerHeader, Title: DrawerTitle, Description: DrawerDescription, Close: DrawerClose }}
            bodyClassName="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]"
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto p-0"
      >
        <MemberDetailPanel
          {...panelProps}
          slots={{ Header: SheetHeader, Title: SheetTitle, Description: SheetDescription, Close: SheetClose }}
          bodyClassName="p-4 space-y-6"
        />
      </SheetContent>
    </Sheet>
  );
}