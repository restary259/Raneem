import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Award, Clock, Info } from "lucide-react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

// Cases at these statuses generate a partner earning
const PAID_STATUSES = ["payment_confirmed", "submitted", "enrollment_paid"];

export default function PartnerEarningsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(500);
  // isPoolMode = partner earns on ALL visible cases (not just partner_id = uid)
  const [isPoolMode, setIsPoolMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
      (supabase as any).from("platform_settings").select("partner_commission_rate").limit(1).maybeSingle(),
    ]);

    // Commission rate: per-partner override takes priority over global setting
    const globalRate = settingsRes.data?.partner_commission_rate ?? 500;
    const override = overrideRes.data;
    setCommissionRate(Number(override?.commission_amount ?? globalRate));

    // Build cases query respecting visibility setting
    // Always fetch partner_id so we can correctly scope commission calculations
    let query = (supabase as any)
      .from("cases")
      .select("id,full_name,status,created_at,source,partner_id")
      .order("created_at", { ascending: false });

    // Agency-generated sources (excludes "referral" = peer student-to-student referrals)
    const PARTNER_SOURCES = ["apply_page", "contact_form", "submit_new_student", "manual"];

    if (override !== null && override !== undefined) {
      if (override.show_all_cases === false) {
        // Apply/Contact Only: agency-generated leads, no peer referrals
        query = query.in("source", PARTNER_SOURCES);
      } else if (override.show_all_cases === null || override.show_all_cases === undefined) {
        // Referral Cases Only: peer student-to-student referrals (source='referral')
        query = query.eq("source", "referral");
      }
      // show_all_cases === true → no extra filter (show everything)
    } else {
      // No override row at all → default: agency-generated leads only
      query = query.in("source", PARTNER_SOURCES);
    }

    const { data, error } = await query;
    if (error) console.error("cases fetch error:", error);
    setCases(data || []);
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

  // Only cases directly attributed to this partner (partner_id = uid) generate commission
  // Other visible cases (unattributed agency leads) appear in pipeline but earn nothing
  const attributedCases = cases.filter((c) => c.partner_id === userId);
  const earningCases = attributedCases.filter((c) => PAID_STATUSES.includes(c.status));
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
        <p className="text-sm text-muted-foreground">
          {t("partner.commission.rateInfo", { rate: commissionRate.toLocaleString() })}
        </p>
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
              <div className="min-w-[400px]">
                {/* Table header */}
                <div className="grid grid-cols-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 border-b border-border mb-2">
                  <span>{t("partner.earnings.colStudent")}</span>
                  <span>{t("partner.earnings.colPaymentStatus")}</span>
                  <span>{t("partner.earnings.colStage")}</span>
                  <span className="text-end">{t("partner.earnings.colCommission")}</span>
                </div>
                {earningCases.map((c) => (
                  <div
                    key={c.id}
                    className="grid grid-cols-4 items-center py-3 border-b border-border/50 last:border-0 text-sm gap-2"
                  >
                    <div>
                      <p className="font-medium text-foreground">{firstNameOnly(c.full_name)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString(isAr ? "ar" : "en-GB")}
                      </p>
                    </div>
                    <Badge className={`text-xs w-fit ${paymentStatusColor(c.status)}`}>{paymentStatus(c.status)}</Badge>
                    <Badge
                      className={`text-xs w-fit ${earningStatusColor[c.status] || "bg-muted text-muted-foreground"}`}
                    >
                      {earningStatusLabel(c.status)}
                    </Badge>
                    <span className="text-end font-bold text-foreground">₪{commissionRate.toLocaleString()}</span>
                  </div>
                ))}
              </div>
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

      <p className="text-xs text-muted-foreground text-center">
        {t("partner.privacyNote")}
      </p>
    </div>
  );
}
