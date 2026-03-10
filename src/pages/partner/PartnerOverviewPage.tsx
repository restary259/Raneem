import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, TrendingUp, Award, CheckCircle, FileCheck, Clock, CreditCard, CalendarDays } from "lucide-react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

const STATUS_COLOR: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  appointment_scheduled: "bg-purple-100 text-purple-700",
  profile_completion: "bg-yellow-100 text-yellow-700",
  payment_confirmed: "bg-emerald-100 text-emerald-700",
  submitted: "bg-green-100 text-green-700",
  enrollment_paid: "bg-teal-100 text-teal-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
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
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [paidRewards, setPaidRewards] = useState<any[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(500);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("dashboard");
  const { dir } = useDirection();
  const isAr = i18n.language === "ar";

  const [isPoolMode, setIsPoolMode] = useState(false);

  const load = useCallback(async (uid: string) => {
    const [profRes, settingsRes, overrideRes] = await Promise.all([
      (supabase as any).from("profiles").select("full_name,email").eq("id", uid).maybeSingle(),
      (supabase as any)
        .from("platform_settings")
        .select("partner_commission_rate,partner_dashboard_show_all_cases")
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from("partner_commission_overrides")
        .select("commission_amount,show_all_cases")
        .eq("partner_id", uid)
        .maybeSingle(),
    ]);

    if (profRes.data) setProfile(profRes.data);

    const rate = settingsRes.data?.partner_commission_rate ?? 500;
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

    // Fetch cases
    let query = (supabase as any)
      .from("cases")
      .select("id,full_name,status,source,created_at,education_level,degree_interest,partner_id")
      .order("created_at", { ascending: false });

    const PARTNER_SOURCES = ["apply_page", "contact_form", "submit_new_student", "manual"];

    if (override !== null && override !== undefined) {
      if (override.show_all_cases === false) {
        query = query.in("source", PARTNER_SOURCES);
      } else if (override.show_all_cases === null) {
        query = query.eq("source", "referral");
      }
    } else {
      if (!globalShowAll) {
        query = query.in("source", PARTNER_SOURCES);
      }
    }

    const { data: casesData, error: casesErr } = await query;
    if (casesErr) console.error("cases fetch error:", casesErr);
    setCases(casesData || []);
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

  useRealtimeSubscription("partner_commission_overrides", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("platform_settings", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("cases", () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription("rewards", () => { if (userId) load(userId); }, !!userId);

  if (!userId || isLoading) return <DashboardLoading />;

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
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: t("partner.paidCases"),
      value: paid,
      icon: CreditCard,
      color: "text-emerald-600 bg-emerald-50",
    },
    { label: t("partner.enrolled"), value: enrolled, icon: Award, color: "text-teal-600 bg-teal-50" },
    {
      label: t('partner.paidThisMonth', 'Paid This Month'),
      value: `₪${paidThisMonth.toLocaleString('en-US')}`,
      icon: CalendarDays,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: t('partner.paidAllTime', 'Paid All Time'),
      value: `₪${paidAllTime.toLocaleString('en-US')}`,
      icon: DollarSign,
      color: "text-primary bg-primary/10",
    },
    {
      label: t("partner.perCaseComm"),
      value: `₪${commissionRate.toLocaleString()}`,
      icon: CheckCircle,
      color: "text-sky-600 bg-sky-50",
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

      {/* Earnings Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-foreground">{t("partner.projectedEarnings")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("partner.projMultiplier", { paid, rate: commissionRate.toLocaleString() })}
          </p>
          {paidAllTime > 0 && (
            <p className="text-xs text-emerald-600 mt-1 font-semibold">
              {t('partner.paidOut', { amount: paidAllTime.toLocaleString('en-US') })}
            </p>
          )}
        </div>
        <p className="text-3xl sm:text-4xl font-black text-primary truncate min-w-0 break-all">₪{(paid * commissionRate).toLocaleString()}</p>
      </div>

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
              <table className="w-full text-sm min-w-[540px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                      {t("partner.col.name")}
                    </th>
                    <th className="hidden sm:table-cell text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                      {t("partner.col.major")}
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
                    const cfg = STATUS_CONFIG[c.status] || {
                      label: c.status,
                      labelAr: c.status,
                      color: "bg-muted text-muted-foreground",
                    };
                    const isPaid = PAID_STATUSES.includes(c.status);
                    const earnsCommission = isPaid && (isPoolMode || c.partner_id === userId);
                    return (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap max-w-[140px] truncate">{c.full_name}</td>
                        <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground text-xs whitespace-nowrap max-w-[100px] truncate">{c.degree_interest || "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            {t(`partner.status.${c.status}`, { defaultValue: cfg.label })}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {earnsCommission ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
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
