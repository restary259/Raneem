import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, TrendingUp, Award, CheckCircle, FileCheck, Clock, CreditCard, CalendarDays } from "lucide-react";
import { toneClasses } from "@/lib/statusTokens";
import { LoadingState } from "@/components/shell";
import ReferralLinkCard from "@/components/dashboard/ReferralLinkCard";


import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

const STATUS_COLOR: Record<string, string> = {
  new: "bg-[hsl(var(--status-new)/0.14)] text-[hsl(var(--status-new))]",
  contacted: "bg-[hsl(var(--status-contacted)/0.14)] text-[hsl(var(--status-contacted))]",
  appointment_scheduled: "bg-[hsl(var(--status-appointment)/0.14)] text-[hsl(var(--status-appointment))]",
  profile_completion: "bg-[hsl(var(--status-profile)/0.14)] text-[hsl(var(--status-profile))]",
  payment_confirmed: "bg-[hsl(var(--status-payment)/0.14)] text-[hsl(var(--status-payment))]",
  submitted: "bg-[hsl(var(--status-submitted)/0.14)] text-[hsl(var(--status-submitted))]",
  enrollment_paid: "bg-[hsl(var(--status-enrolled)/0.14)] text-[hsl(var(--status-enrolled))]",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const PAID_STATUSES = ["payment_confirmed", "submitted", "enrollment_paid"];
const ENROLLED_STATUSES = ["enrollment_paid"];

const startOfCurrentMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export default function PartnerOverviewPage() {
  const [profile, setProfile] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [paidRewards, setPaidRewards] = useState<any[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(500);
  const [isLoading, setIsLoading] = useState(true);
  const { t, i18n } = useTranslation("dashboard");
  const { dir } = useDirection();
  const isAr = i18n.language === "ar";

  const [isPoolMode, setIsPoolMode] = useState(false);

  const load = useCallback(async (uid: string) => {
    const [profRes, settingsRes, overrideRes, roleRes] = await Promise.all([
      (supabase as any).from("profiles").select("full_name,email").eq("id", uid).maybeSingle(),
      (supabase as any)
        .from("platform_settings")
        .select("partner_commission_rate,ambassador_commission_rate,partner_dashboard_show_all_cases")
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from("partner_commission_overrides")
        .select("commission_amount,show_all_cases")
        .eq("partner_id", uid)
        .maybeSingle(),
      (supabase as any).rpc("get_my_role"),
    ]);

    if (profRes.data) setProfile(profRes.data);

    const isAmbassador = roleRes.data === "ambassador";
    const rate = isAmbassador
      ? (settingsRes.data?.ambassador_commission_rate ?? 300)
      : (settingsRes.data?.partner_commission_rate ?? 500);
    const globalShowAll = settingsRes.data?.partner_dashboard_show_all_cases ?? false;
    const override = overrideRes.data;
    setCommissionRate(Number(override?.commission_amount ?? rate));

    let poolMode = false;
    if (override === null || override === undefined) {
      poolMode = !globalShowAll;
    } else {
      poolMode = override.show_all_cases === false;
    }
    setIsPoolMode(poolMode);

    // Fetch actual paid rewards from rewards table
    const { data: rewardsData } = await (supabase as any)
      .from("rewards")
      .select("amount,status,paid_at,admin_notes")
      .eq("user_id", uid)
      .eq("status", "paid")
      .like("admin_notes", "Partner commission from case%");
    setPaidRewards(rewardsData || []);

    // Fetch cases through the partner reader (reduced columns — no phone/notes)
    const PARTNER_SOURCES = ["apply_page", "contact_form", "submit_new_student", "manual"];

    let sources: string[] | null = null;
    if (override !== null && override !== undefined) {
      if (override.show_all_cases === false) {
        sources = PARTNER_SOURCES;
      } else if (override.show_all_cases === null) {
        sources = ["referral"];
      }
    } else if (!globalShowAll) {
      sources = PARTNER_SOURCES;
    }

    const { data: casesData, error: casesErr } = await (supabase as any).rpc(
      "get_partner_pool_cases",
      { p_sources: sources }
    );
    if (casesErr) console.error("cases fetch error:", casesErr);
    setCases(casesData || []);
    setIsLoading(false);
  }, []);

  const userId = useAuthedUserId(load);

  useRealtimeSubscription("partner_commission_overrides", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("platform_settings", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("cases", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("rewards", () => { if (userId) load(userId); }, !!userId);

  if (!userId || isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
        <LoadingState variant="kpi" rows={6} label={t("common.loading", "Loading")} />
        <LoadingState variant="table" rows={6} />
      </div>
    );
  }

  const total = cases.length;
  const commissionEligibleCases = isPoolMode
    ? cases
    : cases.filter((c) => c.partner_id === userId);
  const paid = commissionEligibleCases.filter((c) => PAID_STATUSES.includes(c.status)).length;
  const enrolled = commissionEligibleCases.filter((c) => ENROLLED_STATUSES.includes(c.status)).length;

  // Actual paid totals from rewards table
  const monthStart = startOfCurrentMonth();
  const paidThisMonth = paidRewards
    .filter(r => r.paid_at && r.paid_at >= monthStart)
    .reduce((s: number, r: any) => s + Number(r.amount), 0);
  const paidAllTime = paidRewards
    .reduce((s: number, r: any) => s + Number(r.amount), 0);

  const kpis = [
    {
      label: t("partner.totalApplications"),
      value: total,
      icon: Users,
      color: "text-[hsl(var(--status-contacted))] bg-[hsl(var(--status-contacted)/0.1)]",
    },
    {
      label: t("partner.paidCases"),
      value: paid,
      icon: CreditCard,
      color: "text-[hsl(var(--status-enrolled))] bg-[hsl(var(--status-enrolled)/0.1)]",
    },
    {
      label: t("partner.enrolled"),
      value: enrolled,
      icon: Award,
      color: "text-[hsl(var(--status-profile))] bg-[hsl(var(--status-profile)/0.1)]",
    },
    {
      label: t('partner.paidThisMonth', 'Paid This Month'),
      value: `₪${paidThisMonth.toLocaleString('en-US')}`,
      icon: CalendarDays,
      color: "text-[hsl(var(--status-enrolled))] bg-[hsl(var(--status-enrolled)/0.1)]",
    },
    {
      label: t('partner.paidAllTime', 'Paid All Time'),
      value: `₪${paidAllTime.toLocaleString('en-US')}`,
      icon: DollarSign,
      color: "text-primary bg-primary/10",
    },
    {
      label: t("partner.perCaseComm"),
      value: `₪${commissionRate.toLocaleString('en-US')}`,
      icon: CheckCircle,
      color: "text-brand bg-brand/10",
    },

  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("partner.welcomeGreeting")}
          {profile?.full_name ? `, ${profile.full_name}` : ""}! 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("partner.partnerDashboard")}
        </p>
      </div>

      {/* My referral link — the single link every partner shares */}
      <ReferralLinkCard userId={userId} />




      {/* Earnings Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-foreground">{t("partner.projectedEarnings")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("partner.projMultiplier", { paid, rate: commissionRate.toLocaleString('en-US') })}
          </p>
          {paidAllTime > 0 && (
            <p className="text-xs text-[hsl(var(--status-enrolled))] mt-1 font-semibold">
              {t('partner.paidOut', { amount: paidAllTime.toLocaleString('en-US') })}
            </p>
          )}
        </div>
        <p className={`text-3xl sm:text-4xl font-black ${toneClasses('payment').text} truncate min-w-0 break-all ${paid > 0 ? 'neon-kpi neon-warning' : ''}`}>₪{(paid * commissionRate).toLocaleString('en-US')}</p>
      </div>

      {/* Pipeline breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {t('partner.pipeline.title', 'Pipeline breakdown')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('partner.pipeline.empty', 'No cases yet')}
            </p>
          ) : (
            <div className="space-y-2">
              {(Object.entries(
                cases.reduce((acc: Record<string, number>, c: any) => {
                  acc[c.status] = (acc[c.status] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>),
              ) as [string, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium min-w-[110px] text-center ${STATUS_COLOR[status] || 'bg-muted text-muted-foreground'}`}>
                      {t(`partner.status.${status}`, { defaultValue: status })}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold w-8 text-end">{count.toLocaleString('en-US')}</span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border">
            <CardContent className="p-4">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2.5 ${kpi.color}`}>
                <kpi.icon className="h-4 w-4" />
              </div>
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Case List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">{t("partner.caseList")}</CardTitle>
            <Badge variant="secondary" className="ms-auto text-xs">
              {total}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {cases.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t("partner.noCases")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-0">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                      {t("partner.col.name")}
                    </th>
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                      {t("partner.col.status")}
                    </th>
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                      {t("partner.col.commission")}
                    </th>
                    <th className="hidden sm:table-cell text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                      {t("partner.col.date")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => {
                    const statusColor = STATUS_COLOR[c.status] || "bg-muted text-muted-foreground";
                    const isPaid = PAID_STATUSES.includes(c.status);
                    const earnsCommission = isPaid && (isPoolMode || c.partner_id === userId);
                    return (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap max-w-[140px] truncate">{c.full_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                            {t(`partner.status.${c.status}`, { defaultValue: c.status })}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {earnsCommission ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--status-enrolled))]">
                              <CheckCircle className="h-3 w-3 shrink-0" />
                              ₪{commissionRate.toLocaleString('en-US')} {t("partner.projLabel")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 shrink-0" />
                              {t("partner.pending")}
                            </span>
                          )}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString("en-US")}
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
    </div>
  );
}
