import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Award, Clock, Info, History } from "lucide-react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

// Cases at these statuses generate a partner earning
const PAID_STATUSES = ["payment_confirmed", "submitted", "enrollment_paid"];

export default function PartnerEarningsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(500);
  const [isPoolMode, setIsPoolMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [paidHistory, setPaidHistory] = useState<any[]>([]);
  const [paidCaseMap, setPaidCaseMap] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("dashboard");
  const { dir } = useDirection();
  const isAr = i18n.language === "ar";

  const load = useCallback(async (uid: string) => {
    // Fetch override + global settings in parallel
    const [overrideRes, settingsRes] = await Promise.all([
      (supabase as any)
        .from("partner_commission_overrides")
        .select("commission_amount,show_all_cases")
        .eq("partner_id", uid)
        .maybeSingle(),
      (supabase as any)
        .from("platform_settings")
        .select("partner_commission_rate,partner_dashboard_show_all_cases")
        .limit(1)
        .maybeSingle(),
    ]);

    // Commission rate: per-partner override takes priority over global setting
    const globalRate = settingsRes.data?.partner_commission_rate ?? 500;
    const globalShowAll = settingsRes.data?.partner_dashboard_show_all_cases ?? false;
    const override = overrideRes.data;
    setCommissionRate(Number(override?.commission_amount ?? globalRate));

    // Pool mode: earn commission on ALL visible agency cases (not just partner_id = uid)
    // Applies when: no override row (default agency pool), OR override.show_all_cases === false
    let poolMode = false;
    if (override === null || override === undefined) {
      poolMode = !globalShowAll;
    } else {
      poolMode = override.show_all_cases === false;
    }
    setIsPoolMode(poolMode);

    // Build cases query respecting visibility setting
    let query = (supabase as any)
      .from("cases")
      .select("id,full_name,status,created_at,source,partner_id")
      .order("created_at", { ascending: false });

    // Agency-generated sources (excludes "referral" = peer student-to-student referrals)
    const PARTNER_SOURCES = ["apply_page", "contact_form", "submit_new_student", "manual"];

    if (override !== null && override !== undefined) {
      if (override.show_all_cases === false) {
        query = query.in("source", PARTNER_SOURCES);
      } else if (override.show_all_cases === null || override.show_all_cases === undefined) {
        query = query.eq("source", "referral");
      }
      // show_all_cases === true → no extra filter
    } else {
      if (!globalShowAll) {
        query = query.in("source", PARTNER_SOURCES);
      }
    }

    const { data, error } = await query;
    if (error) console.error("cases fetch error:", error);
    setCases(data || []);

    // Fetch paid reward history
    const { data: historyRows } = await (supabase as any)
      .from("rewards")
      .select("id,amount,paid_at,admin_notes")
      .eq("user_id", uid)
      .eq("status", "paid")
      .like("admin_notes", "Partner commission from case%")
      .order("paid_at", { ascending: false });

    const history = historyRows || [];
    setPaidHistory(history);

    // Batch-fetch case names for history
    const caseIds = [...new Set(
      history.map((r: any) => r.admin_notes?.replace("Partner commission from case ", "").trim()).filter((id: string) => id?.length === 36)
    )] as string[];
    if (caseIds.length > 0) {
      const { data: caseRows } = await (supabase as any).from("cases").select("id,full_name").in("id", caseIds);
      const map: Record<string, string> = {};
      (caseRows || []).forEach((c: any) => { map[c.id] = c.full_name; });
      setPaidCaseMap(map);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/student-auth");
        return;
      }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, [navigate, load]);

  // Real-time: refetch when commission overrides, settings, or cases change
  useRealtimeSubscription("partner_commission_overrides", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("platform_settings", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("cases", () => { if (userId) load(userId); }, !!userId);

  if (!userId || isLoading) return <DashboardLoading />;

  const firstNameOnly = (full: string) => full?.split(" ")[0] || "—";

  // Pool mode: all visible paid cases earn commission (applies to Apply/Contact Only + No Override)
  // Attribution mode: only cases where partner_id = uid earn commission
  const commissionEligible = isPoolMode
    ? cases
    : cases.filter((c) => c.partner_id === userId);
  const earningCases = commissionEligible.filter((c) => PAID_STATUSES.includes(c.status));
  const pipelineCases = cases.filter((c) => !PAID_STATUSES.includes(c.status));

  const confirmedCases = earningCases.filter((c) => c.status === "enrollment_paid");
  const pendingCases = earningCases.filter((c) => c.status !== "enrollment_paid");

  const totalEarnings = earningCases.length * commissionRate;
  const confirmedEarnings = confirmedCases.length * commissionRate;
  const pendingEarnings = pendingCases.length * commissionRate;

  const earningStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      payment_confirmed: t("partner.status.payment"),
      submitted: t("partner.earnings.submitted"),
      enrollment_paid: t("partner.earnings.enrolled"),
    };
    return map[s] ?? s;
  };

  const earningStatusColor: Record<string, string> = {
    payment_confirmed: "bg-amber-100 text-amber-800",
    submitted: "bg-cyan-100 text-cyan-800",
    enrollment_paid: "bg-green-100 text-green-800",
  };

  const paymentStatus = (s: string) =>
    s === "enrollment_paid" ? t("partner.earnings.confirmedLabel") : t("partner.earnings.pendingLabel");

  const paymentStatusColor = (s: string) =>
    s === "enrollment_paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800";

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" dir={dir}>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <DollarSign className="h-6 w-6 text-primary" />
        {t("partner.earningsTitle")}
      </h1>

      {/* Commission Rate Info */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {t("partner.commission.rateInfo", { rate: commissionRate.toLocaleString('en-US') })}
          </p>
          <p className="text-xs text-muted-foreground/70">
            {isAr
              ? "المبالغ المعروضة هي أرباح متوقعة محسوبة بناءً على معدل العمولة × عدد الطلاب المؤهلين. يتم تأكيد الدفع الفعلي بعد اكتمال التسجيل ومعالجة طلب الصرف — وليس فور الوصول إلى مرحلة التسجيل."
              : "Amounts shown are projected earnings based on your commission rate × qualifying students. Actual payout is confirmed after final enrollment is complete and a payout request is processed — not at the point of enrollment status."}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Award className="h-4 w-4 text-green-600" />
              <span className="text-xs">{t("partner.earnings.total")}</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground truncate min-w-0">₪{totalEarnings.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {earningCases.length} {isAr ? "طالب" : "students"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-cyan-600" />
              <span className="text-xs">{t("partner.earnings.pendingLabel")}</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground truncate min-w-0">₪{pendingEarnings.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pendingCases.length} {isAr ? "طالب" : "students"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-xs">{t("partner.earnings.confirmedLabel")}</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground truncate min-w-0">₪{confirmedEarnings.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {confirmedCases.length} {isAr ? "طالب" : "students"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Breakdown Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("partner.earnings.breakdown")}</CardTitle>
        </CardHeader>
        <CardContent>
          {earningCases.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              {t("partner.earnings.noQualifying")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 px-1 whitespace-nowrap">
                      {t("partner.earnings.colStudent")}
                    </th>
                    <th className="text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 px-1 whitespace-nowrap">
                      {t("partner.earnings.colPaymentStatus")}
                    </th>
                    <th className="hidden sm:table-cell text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 px-1 whitespace-nowrap">
                      {t("partner.earnings.colStage")}
                    </th>
                    <th className="text-end text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 px-1 whitespace-nowrap">
                      {t("partner.earnings.colCommission")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {earningCases.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 px-1 whitespace-nowrap">
                        <p className="font-medium text-foreground">{firstNameOnly(c.full_name)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString(isAr ? "ar" : "en-GB")}
                        </p>
                      </td>
                      <td className="py-3 px-1 whitespace-nowrap">
                        <Badge className={`text-xs w-fit ${paymentStatusColor(c.status)}`}>{paymentStatus(c.status)}</Badge>
                      </td>
                      <td className="hidden sm:table-cell py-3 px-1 whitespace-nowrap">
                        <Badge className={`text-xs w-fit ${earningStatusColor[c.status] || "bg-muted text-muted-foreground"}`}>
                          {earningStatusLabel(c.status)}
                        </Badge>
                      </td>
                      <td className="py-3 px-1 text-end whitespace-nowrap font-bold text-foreground">
                        ₪{commissionRate.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline (non-earning) */}
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
            {isAr ? "سجل المدفوعات" : "Payment History"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paidHistory.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              {isAr ? "لا توجد مدفوعات مؤكدة بعد" : "No confirmed payments yet"}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {paidHistory.map((r: any) => {
                const caseId = r.admin_notes?.replace("Partner commission from case ", "").trim();
                const studentName = paidCaseMap[caseId]?.split(" ")[0] ?? "—";
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.paid_at ? new Date(r.paid_at).toLocaleDateString(isAr ? "ar" : "en-GB") : "—"}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-emerald-600">₪{Number(r.amount).toLocaleString()}</p>
                      <Badge className="text-xs bg-emerald-100 text-emerald-800">{isAr ? "مدفوع" : "Paid"}</Badge>
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
