import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { DollarSign, Award, Clock, Info, History, CheckCircle2, Hourglass, Send, Lock } from "lucide-react";
import { toneClasses } from "@/lib/statusTokens";
import { LoadingState } from "@/components/shell";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useToast } from "@/hooks/use-toast";
import { useEarningsSummary } from "@/hooks/useEarningsSummary";
import {
  fetchPartnerVisibilityOverride,
  resolvePartnerVisibilityMode,
  resolveVisibilitySources,
  type ResolvedPartnerVisibilityMode,
} from "@/lib/partnerVisibility";

// Cases at these statuses generate a partner earning
const PAID_STATUSES = ["payment_confirmed", "submitted", "enrollment_paid"];
const LOCK_DAYS = 20;

export default function PartnerEarningsPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(0);
  const [isPoolMode, setIsPoolMode] = useState(false);
  const [visibilityMode, setVisibilityMode] = useState<ResolvedPartnerVisibilityMode>('partner_sources');
  const [isLoading, setIsLoading] = useState(true);
  const [rewards, setRewards] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [paidCaseMap, setPaidCaseMap] = useState<Record<string, string>>({});
  const [payoutPreview, setPayoutPreview] = useState<any>(null);


  const { summary: earnings, refetch: refetchEarnings } = useEarningsSummary(true);
  const { t, i18n } = useTranslation("dashboard");
  const { dir } = useDirection();
  const { toast } = useToast();
  const isAr = i18n.language === "ar";

  const load = useCallback(async (uid: string) => {
    const [overrideRes, settingsRes, roleRes] = await Promise.all([
      fetchPartnerVisibilityOverride(uid),
      (supabase as any)
        .from("platform_settings")
        .select("partner_commission_rate,ambassador_commission_rate,partner_dashboard_show_all_cases")
        .limit(1)
        .maybeSingle(),
      (supabase as any).rpc("get_my_role"),
    ]);

    const globalRate = roleRes?.data === "ambassador"
      ? Number(settingsRes.data?.ambassador_commission_rate ?? 0)
      : Number(settingsRes.data?.partner_commission_rate ?? 0);
    const globalShowAll = settingsRes.data?.partner_dashboard_show_all_cases ?? false;
    const override = overrideRes;
    setCommissionRate(Number(override?.commission_amount ?? globalRate));

    const mode = resolvePartnerVisibilityMode(override, globalShowAll);
    const sources = resolveVisibilitySources(override, globalShowAll);
    setIsPoolMode(mode === 'partner_sources');
    setVisibilityMode(mode);

    const { data: casesData, error } = await (supabase as any).rpc(
      "get_partner_pool_cases",
      { p_sources: sources }
    );
    if (error) console.error("cases fetch error:", error);
    setCases(casesData || []);

    // Single source of truth for payout eligibility (same RPC the payout dialog uses)
    const { data: preview } = await (supabase as any).rpc("get_my_payout_preview");
    setPayoutPreview(preview || null);

    // Fetch ALL partner commission rewards (pending, approved, paid)
    const { data: rewardRows } = await (supabase as any)
      .from("rewards")
      .select("id,amount,status,paid_at,admin_notes,created_at,payout_requested_at")
      .eq("user_id", uid)
      .like("admin_notes", "Partner commission from case%")
      .order("created_at", { ascending: false });

    // Payout requests carry the reference number the partner quotes to Darb.
    const { data: requestRows } = await (supabase as any)
      .from("payout_requests")
      .select("id,payout_reference,amount,status,requested_at,paid_at")
      .eq("requestor_id", uid)
      .order("requested_at", { ascending: false });
    setMyRequests(requestRows || []);

    const allRewards = rewardRows || [];
    setRewards(allRewards);

    // Resolve paid-case names from the cases already loaded above via the
    // get_partner_pool_cases reader (SECURITY DEFINER). A direct
    // `.from('cases').select(...)` is blocked by RLS for partner/ambassador
    // roles (the only cases SELECT policy was dropped in 20260806020018 and
    // never recreated — partners reach cases only through the RPC), so the
    // previous direct lookup silently returned an empty map and paid case
    // names rendered as "—". Reusing the already-fetched list avoids a second
    // round-trip AND the RLS dead-end.
    const map: Record<string, string> = {};
    for (const c of casesData ?? []) {
      map[c.id] = c.full_name;
    }
    setPaidCaseMap(map);

    setIsLoading(false);
  }, []);

  const userId = useAuthedUserId(load);

  useRealtimeSubscription("partner_commission_overrides", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("platform_settings", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("cases", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("rewards", () => { if (userId) { load(userId); refetchEarnings(); } }, !!userId);
  useRealtimeSubscription("payout_requests", () => { if (userId) { load(userId); refetchEarnings(); } }, !!userId);

  if (!userId || isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" dir={dir}>
        <LoadingState variant="kpi" rows={3} label={t("common.loading", "Loading")} />
        <LoadingState variant="table" rows={5} />
      </div>
    );
  }

  const firstNameOnly = (full: string) => full?.split(" ")[0] || "—";

  const commissionEligible = isPoolMode ? cases : cases.filter((c) => c.partner_id === userId);
  const earningCases = commissionEligible.filter((c) => PAID_STATUSES.includes(c.status));
  const pipelineCases = cases.filter((c) => !PAID_STATUSES.includes(c.status));

  // ── Authoritative balances: server-side, mutually exclusive buckets ──
  const items = earnings.items ?? [];
  const lockedPending = items.filter((i) => i.status === "locked");
  const availableItems = items.filter((i) => i.status === "available");
  const requestedItems = items.filter((i) => i.status === "requested");
  const paidRewardsList = items.filter((i) => i.status === "paid");

  const pendingAmount = Number(earnings.locked);
  const approvedAmount = Number(earnings.requested) + Number(earnings.available);
  const paidAmount = Number(earnings.paid);
  const totalAmount = Number(earnings.total);

  const now = new Date();
  const hasOpenRequest = !!earnings.has_open_request;
  const unlockedAmount = Number(earnings.available);
  const eligibleCount = availableItems.length;
  const canRequestPayout = eligibleCount > 0 && !hasOpenRequest;





  const getCaseRewardInfo = (caseId: string) => {
    const reward = rewards.find((r: any) => r.admin_notes?.includes(caseId));
    if (!reward) return { label: isAr ? "متوقع" : "Projected", color: "bg-[hsl(var(--status-payment)/0.14)] text-[hsl(var(--status-payment))]" };
    if (reward.status === "paid") return { label: isAr ? "مدفوع" : "Paid", color: "bg-[hsl(var(--status-enrolled)/0.14)] text-[hsl(var(--status-enrolled))]" };
    if (reward.status === "approved") return { label: isAr ? "طلب صرف مقدم" : "Payout Requested", color: "bg-[hsl(var(--status-contacted)/0.14)] text-[hsl(var(--status-contacted))]" };
    const age = (now.getTime() - new Date(reward.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (age < LOCK_DAYS) {
      const daysLeft = Math.ceil(LOCK_DAYS - age);
      return {
        label: isAr ? `مقفل (${daysLeft} يوم)` : `Locked (${daysLeft}d)`,
        color: "bg-muted text-muted-foreground",
      };
    }
    return { label: isAr ? "متاح للصرف" : "Ready for Payout", color: "bg-brand/10 text-brand" };
  };

  const caseStageLabel = (s: string) => {
    const map: Record<string, string> = {
      payment_confirmed: isAr ? "تم الدفع" : "Payment Confirmed",
      submitted: isAr ? "مقدم" : "Submitted",
      enrollment_paid: isAr ? "مسجل ✅" : "Enrolled ✅",
    };
    return map[s] ?? s;
  };

  const caseStageColor: Record<string, string> = {
    payment_confirmed: "bg-[hsl(var(--status-payment)/0.14)] text-[hsl(var(--status-payment))]",
    submitted: "bg-[hsl(var(--status-submitted)/0.14)] text-[hsl(var(--status-submitted))]",
    enrollment_paid: "bg-[hsl(var(--status-enrolled)/0.14)] text-[hsl(var(--status-enrolled))]",
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" dir={dir}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" />
          {t("partner.earningsTitle")}
        </h1>
        {/* Payout is requested inside the Administration chat. */}
        {canRequestPayout && (
          <Button asChild className="gap-2 shrink-0" size="sm">
            <Link to="/partner/messages">
              <Send className="h-4 w-4" />
              {isAr
                ? `طلب صرف ₪${unlockedAmount.toLocaleString("en-US")} عبر المحادثة`
                : `Request payout ₪${unlockedAmount.toLocaleString("en-US")} in chat`}
            </Link>
          </Button>
        )}

        {hasOpenRequest && (
          <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--status-contacted))] bg-[hsl(var(--status-contacted)/0.1)] border border-[hsl(var(--status-contacted)/0.3)] rounded-full px-3 py-1.5">
            <Hourglass className="h-3.5 w-3.5" />
            {isAr ? "طلب صرف قيد المراجعة" : "Payout request under review"}
          </div>
        )}

        {lockedPending.length > 0 && !canRequestPayout && !hasOpenRequest && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-full px-3 py-1.5">
            <Lock className="h-3.5 w-3.5" />
            {isAr ? `مقفل — ${LOCK_DAYS} يوم قفل` : `Locked — ${LOCK_DAYS}-day hold`}
          </div>
        )}
      </div>

      {/* Commission Rate Info */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {t("partner.commission.rateInfo", { rate: commissionRate.toLocaleString("en-US") })}
          </p>
          <p className="text-xs text-muted-foreground/70">
            {isAr
              ? `أرباح محققة. يُمكن طلب الصرف بعد مرور ${LOCK_DAYS} يوماً من تسجيل كل حالة وموافقة الإدارة.`
              : `Accrued earnings. Payout can be requested after a ${LOCK_DAYS}-day hold per case and admin approval.`}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Award className={`h-4 w-4 ${toneClasses('payment').text}`} />
              <span className="text-xs">{t("partner.earnings.total")}</span>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${toneClasses('payment').text} truncate min-w-0`}>
              ₪{totalAmount.toLocaleString("en-US")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("partner.earnings.studentCount", { count: rewards.length })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Hourglass className="h-4 w-4 text-[hsl(var(--status-payment))]" />
              <span className="text-xs">{isAr ? "في الانتظار" : "Awaiting Payout"}</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-[hsl(var(--status-payment))] truncate min-w-0">
              ₪{(pendingAmount + approvedAmount).toLocaleString("en-US")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("partner.earnings.studentCount", { count: lockedPending.length + requestedItems.length + availableItems.length })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-enrolled))]" />
              <span className="text-xs">{isAr ? "مدفوع" : "Paid Out"}</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-[hsl(var(--status-enrolled))] truncate min-w-0">
              ₪{paidAmount.toLocaleString("en-US")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("partner.earnings.studentCount", { count: paidRewardsList.length })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout requests — the reference number is what Darb quotes on the transfer */}
      {myRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {isAr ? "طلبات الصرف" : "Payout requests"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {myRequests.map((r: any) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="font-mono text-sm" dir="ltr">{r.payout_reference ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.requested_at).toLocaleDateString("en-US")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">₪{Number(r.amount).toLocaleString("en-US")}</span>
                    <Badge variant="secondary">{String(t(`chat.payout.status.${r.status}`, r.status))}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Earnings Breakdown Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("partner.earnings.breakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          {earningCases.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">
                {t("partner.earnings.noQualifying")}
              </p>
              {visibilityMode === 'referral_only' && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('partner.visibility.referralOnlyHint', 'Referral-only mode: apply/contact cases are hidden.')}
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 px-1 whitespace-nowrap">
                      {t("partner.earnings.colStudent")}
                    </th>
                    <th className="text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 px-1 whitespace-nowrap">
                      {isAr ? "حالة الدفع" : "Payout Status"}
                    </th>
                    <th className="hidden sm:table-cell text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 px-1 whitespace-nowrap">
                      {isAr ? "مرحلة الحالة" : "Case Stage"}
                    </th>
                    <th className="text-end text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 px-1 whitespace-nowrap">
                      {t("partner.earnings.colCommission")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {earningCases.map((c) => {
                    const rewardInfo = getCaseRewardInfo(c.id);
                    return (
                      <tr key={c.id} className="border-b border-border/50 last:border-0">
                        <td className="py-3 px-1 whitespace-nowrap">
                          <p className="font-medium text-foreground">{firstNameOnly(c.full_name)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString("en-US")}
                          </p>
                        </td>
                        <td className="py-3 px-1 whitespace-nowrap">
                          <Badge className={`text-xs w-fit ${rewardInfo.color}`}>{rewardInfo.label}</Badge>
                        </td>
                        <td className="hidden sm:table-cell py-3 px-1 whitespace-nowrap">
                          <Badge className={`text-xs w-fit ${caseStageColor[c.status] || "bg-muted text-muted-foreground"}`}>
                            {caseStageLabel(c.status)}
                          </Badge>
                        </td>
                        <td className="py-3 px-1 text-end whitespace-nowrap font-bold text-foreground">
                          ₪{commissionRate.toLocaleString('en-US')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline */}
      {pipelineCases.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("partner.earnings.inPipeline")}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {pipelineCases.map((c) => (
              <div key={c.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-muted-foreground">{firstNameOnly(c.full_name)}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {c.status.replace(/_/g, " ")}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            {t("partner.paymentHistory")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paidRewardsList.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              {t("partner.noPaymentHistory")}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {paidRewardsList.map((r) => {
                const studentName = r.student_name?.split(" ")[0] ?? "—";
                return (
                  <div key={r.reward_id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.commission_reference ?? (r.case_reference ?? "—")}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-[hsl(var(--status-enrolled))]">₪{Number(r.amount).toLocaleString("en-US")}</p>
                      <Badge className="text-xs bg-[hsl(var(--status-enrolled)/0.14)] text-[hsl(var(--status-enrolled))]">{t("partner.paymentHistoryBadge")}</Badge>
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        {t("partner.privacyNote")}
      </p>

    </div>
  );
}

