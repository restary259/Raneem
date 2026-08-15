import React from "react";
import { useTranslation } from "react-i18next";
import { useDirection } from "@/hooks/useDirection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Megaphone, GraduationCap, Award, BarChart2 } from "lucide-react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { useAgentOverview } from "@/hooks/useAgentOverview";

const fmt = (n: number) => `₪${Number(n || 0).toLocaleString("en-US")}`;

/** Agent analytics: performance breakdown by source, per-recruit top
 *  performers, and commission trend. Visually consistent with the partner
 *  performance page (inline bars + numeric KPIs, no charting library). */
export default function AgentAnalyticsPage() {
  const { t } = useTranslation("dashboard");
  const { dir } = useDirection();
  const { recruits, stats, rates, earnings, loading } = useAgentOverview();

  if (loading) return <DashboardLoading />;

  const topPerformers = [...recruits]
    .sort((a, b) => Number(b.override_earned) - Number(a.override_earned))
    .slice(0, 10);

  const maxOverride = Math.max(1, ...recruits.map((r) => Number(r.override_earned || 0)));
  const maxStudents = Math.max(1, ...recruits.map((r) => Number(r.students_count || 0)));

  const sourceBreakdown = [
    {
      label: t("agent.sourcePartner", "Via recruited partners"),
      icon: Users,
      count: stats.totalPartners,
      students: recruits.filter((r) => !r.role || r.role === "social_media_partner").reduce((s, r) => s + Number(r.students_count), 0),
      rate: rates.perRecruit,
    },
    {
      label: t("agent.sourceAmbassador", "Via recruited ambassadors"),
      icon: Megaphone,
      count: stats.totalAmbassadors,
      students: recruits.filter((r) => r.role === "ambassador").reduce((s, r) => s + Number(r.students_count), 0),
      rate: rates.perRecruit,
    },
    {
      label: t("agent.sourceSelfReferral", "Your own referrals"),
      icon: GraduationCap,
      count: null,
      students: null,
      rate: rates.selfReferral.effective,
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-primary" />
          {t("agent.analyticsTitle", "Analytics")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("agent.analyticsSubtitle", "Performance breakdown by source and recruit.")}
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2.5 text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15">
            <Users className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold">{stats.totalPartners + stats.totalAmbassadors}</p>
          <p className="text-xs text-muted-foreground">{t("agent.ovRecruitedPartners", "Recruits")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2.5 text-teal-600 bg-teal-50 dark:text-teal-300 dark:bg-teal-500/15">
            <GraduationCap className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold">{stats.networkStudents}</p>
          <p className="text-xs text-muted-foreground">{t("agent.ovNetworkStudents", "Network students")}</p>
          <p className="text-[11px] text-muted-foreground">{t("agent.networkStudentsHint", "Via partners & ambassadors")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2.5 text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15">
            <Award className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold">{stats.paidCases}</p>
          <p className="text-xs text-muted-foreground">{t("agent.ovPaidCases", "Paid cases")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2.5 text-primary bg-primary/10">
            <TrendingUp className="h-4 w-4" />
          </div>
          <p className="text-xl font-bold">{fmt(earnings.total)}</p>
          <p className="text-xs text-muted-foreground">{t("agent.totalEarnings", "Total earnings")}</p>
        </CardContent></Card>
      </div>

      {/* Source breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("agent.sourceBreakdown", "Commission by source")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("agent.sourceBreakdownEqualNote", "Partners and ambassadors earn the same override rate.")}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {sourceBreakdown.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-muted text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.count != null && `${s.count} ${t("agent.recruits", "recruits")} · `}
                    {s.students != null && `${s.students} ${t("agent.colStudents", "Students")}`}
                    {s.students == null && t("agent.sourceSelfReferralHint", "Students from your personal apply form")}
                  </p>
                </div>
                <p className="text-sm font-bold text-primary shrink-0">{fmt(s.rate)}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Top performers */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">{t("agent.topPerformers", "Top performers")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {topPerformers.length === 0 || topPerformers.every((r) => Number(r.override_earned) === 0) ? (
            <div className="py-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("agent.noPerformers", "No performance data yet")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {topPerformers.map((r, i) => (
                <div key={r.partner_id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold text-muted-foreground shrink-0">
                        {i + 1}
                      </span>
                      <p className="font-medium text-sm truncate">{r.full_name}</p>
                      {r.role === "ambassador" && (
                        <Badge variant="secondary" className="text-xs shrink-0">{t("agent.roleAmbassador", "Ambassador")}</Badge>
                      )}
                    </div>
                    <span className="text-sm font-bold text-emerald-600 shrink-0">{fmt(r.override_earned)}</span>
                  </div>
                  {/* Students bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">{t("agent.colStudents", "Students")}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(Number(r.students_count) / maxStudents) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold w-8 text-end">{Number(r.students_count)}</span>
                  </div>
                  {/* Earnings bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">{t("agent.earningsTitle", "Earnings")}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${(Number(r.override_earned) / maxOverride) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold w-8 text-end">{fmt(r.override_earned)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
