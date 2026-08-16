import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { formatILS } from "@/lib/money";
import { Shield, Handshake, UserCheck, Users, Crown, DollarSign, Award, Trash2, AlertCircle } from "lucide-react";
import MasterPartnerToggle from "./MasterPartnerToggle";
import AgentInviteToggle from "./AgentInviteToggle";
import AgentCreateAccountsToggle from "./AgentCreateAccountsToggle";
import DeactivateAccountDialog from "./DeactivateAccountDialog";

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

export default function MemberDetailDrawer({ member, open, onOpenChange }: MemberDetailDrawerProps) {
  const { t } = useTranslation("dashboard");
  const [breakdown, setBreakdown] = useState<CommissionBreakdown | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);

  // Track the latest requested id so a slow response from a previous member
  // can't overwrite the currently-open member's breakdown (stale-data race).
  const latestIdRef = useRef<string | null>(null);

  const loadBreakdown = useCallback(async (id: string) => {
    latestIdRef.current = id;
    setLoadingBreakdown(true);
    setBreakdownError(false);
    try {
      const { data, error } = await supabase.rpc("get_account_commission_history", {
        p_user_id: id,
      });
      // A later request may have started; discard this stale response.
      if (latestIdRef.current !== id) return;
      if (error) throw error;
      setBreakdown(data as CommissionBreakdown);
    } catch (err) {
      if (latestIdRef.current !== id) return;
      console.error("Failed to load commission breakdown:", err);
      setBreakdown(null);
      setBreakdownError(true);
    } finally {
      if (latestIdRef.current === id) setLoadingBreakdown(false);
    }
  }, []);

  useEffect(() => {
    if (member?.requester_id) {
      setBreakdown(null);
      setBreakdownError(false);
      loadBreakdown(member.requester_id);
    } else {
      latestIdRef.current = null;
      setBreakdown(null);
      setBreakdownError(false);
      setLoadingBreakdown(false);
    }
  }, [member?.requester_id, loadBreakdown]);

  useEffect(() => {
    if (!open) setShowDeactivate(false);
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
          { label: t("admin.members.kpiOverrideEarned", "Override Earned"), value: formatILS(member.earned_override), icon: Crown },
        ];
      case "social_media_partner":
      case "ambassador":
        return [
          { label: t("admin.members.kpiReferred", "Referred"), value: String(member.students_count), icon: Users },
          { label: t("admin.members.kpiEarnedReferral", "Earned (Referral)"), value: formatILS(member.earned_referral), icon: DollarSign },
          { label: t("admin.members.kpiEarnedOverride", "Earned (Master)"), value: formatILS(member.earned_master_override), icon: Crown },
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl lg:max-w-2xl flex flex-col p-0 gap-0"
      >
        <SheetHeader className="flex flex-col gap-3 p-4 border-b shrink-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
              <RoleIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <SheetTitle className="flex items-center gap-2">
                {member.full_name}
                <Badge variant="secondary" className="text-xs gap-1">
                  <RoleIcon className="h-3 w-3" />
                  {roleLabel}
                </Badge>
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 text-xs">
                {member.email}
                {member.phone_number && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    {member.phone_number}
                  </>
                )}
              </SheetDescription>
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
            <Button variant="ghost" size="sm" onClick={() => setShowDeactivate(true)}>
              <Trash2 className="h-4 w-4" />
              {t("admin.members.deactivate", "Deactivate")}
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Primary KPIs */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                {t("admin.members.sectionPerformance", "Performance")}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
              ) : breakdownError ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{t("admin.members.commissionLoadError", "Failed to load commission data")}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => member?.requester_id && loadBreakdown(member.requester_id)}
                  >
                    {t("admin.members.retry", "Retry")}
                  </Button>
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

          {/* Role-specific Actions */}
          {(member.role === "social_media_partner" || member.role === "ambassador") && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  {t("admin.members.sectionActions", "Actions")}
                </h3>
                <MasterPartnerToggle
                  partnerId={member.requester_id}
                  isMaster={member.is_master_partner}
                  partnerName={member.full_name}
                  variant="plain"
                />
              </CardContent>
            </Card>
          )}

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
                {member.master_partner_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("admin.members.masterPartnerId", "Master Partner ID")}</span>
                    <span className="font-mono text-xs">{member.master_partner_id.slice(0, 8)}…</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <DeactivateAccountDialog
          open={showDeactivate}
          onOpenChange={setShowDeactivate}
          userId={member.requester_id}
          userEmail={member.email}
          userName={member.full_name}
        />
      </SheetContent>
    </Sheet>
  );
}
