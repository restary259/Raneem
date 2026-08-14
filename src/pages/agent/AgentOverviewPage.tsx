import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Megaphone,
  TrendingUp,
  Award,
  GraduationCap,
  HandCoins,
  Wallet,
  ArrowUpRight,
  UserPlus,
  MessageSquare,
  Link2,
  Copy,
  Check,
} from "lucide-react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { useAgentOverview } from "@/hooks/useAgentOverview";

const fmt = (n: number) => `₪${Number(n || 0).toLocaleString("en-US")}`;

/** Agent overview: a premium command-center tailored to the agent role.
 *  Shows the three student sources, network composition, earnings buckets,
 *  commission rates, and quick actions — visually consistent with the
 *  Partner dashboard. */
export default function AgentOverviewPage() {
  const { t } = useTranslation("dashboard");
  const { dir } = useDirection();
  const { profile, recruits, stats, rates, earnings, loading, refetch } = useAgentOverview();

  useRealtimeSubscription("rewards", () => refetch(), !!profile);
  useRealtimeSubscription("profiles", () => refetch(), !!profile);

  const [copied, setCopied] = React.useState(false);
  const recruitUrl = profile?.recruit_code
    ? `${window.location.origin}/join/${profile.recruit_code}`
    : "";

  const copyLink = async () => {
    if (!recruitUrl) return;
    try {
      await navigator.clipboard.writeText(recruitUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard may be unavailable */ }
  };

  if (loading) return <DashboardLoading />;

  const kpis = [
    {
      label: t("agent.ovRecruitedPartners", "Recruited partners"),
      value: stats.totalPartners,
      icon: Users,
      color: "text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15",
    },
    {
      label: t("agent.ovRecruitedAmbassadors", "Recruited ambassadors"),
      value: stats.totalAmbassadors,
      icon: Megaphone,
      color: "text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-500/15",
    },
    {
      label: t("agent.ovNetworkStudents", "Network students"),
      value: stats.networkStudents,
      icon: GraduationCap,
      color: "text-teal-600 bg-teal-50 dark:text-teal-300 dark:bg-teal-500/15",
    },
    {
      label: t("agent.ovPaidCases", "Paid cases"),
      value: stats.paidCases,
      icon: Award,
      color: "text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15",
    },
  ];

  const earningsBuckets = [
    { label: t("agent.earningsAvailable", "Available"), value: earnings.available, icon: Wallet, color: "text-emerald-600" },
    { label: t("agent.earningsLocked", "Locked"), value: earnings.locked, icon: HandCoins, color: "text-amber-600" },
    { label: t("agent.earningsRequested", "Requested"), value: earnings.requested, icon: TrendingUp, color: "text-blue-600" },
    { label: t("agent.earningsPaid", "Paid"), value: earnings.paid, icon: Award, color: "text-teal-600" },
  ];

  const recentRecruits = [...recruits]
    .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
      {/* Welcome */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">
            {t("agent.welcome", "Welcome")}
            {profile?.full_name ? `, ${profile.full_name}` : ""}! 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("agent.subtitle", "Agent dashboard")}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/agent/recruit">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("agent.recruitCta", "Recruit")}</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link to="/agent/messages">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">{t("agent.messageAdmin", "Message Admin")}</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Earnings banner */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{t("agent.totalEarnings", "Total earnings")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("agent.earningsBannerHint", "Override commissions from your recruited network + self-referrals.")}
          </p>
          {earnings.paid > 0 && (
            <p className="text-xs text-emerald-600 mt-1 font-semibold">
              {t("agent.paidOut", { amount: earnings.paid.toLocaleString("en-US") })}
            </p>
          )}
        </div>
        <p className="text-3xl sm:text-4xl font-black text-primary truncate min-w-0 break-all">
          {fmt(earnings.total)}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border">
            <CardContent className="p-4">
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2.5 ${kpi.color}`}>
                <kpi.icon className="h-4 w-4" />
              </div>
              <p className="text-xl font-bold text-foreground">
                {typeof kpi.value === "number" ? kpi.value.toLocaleString("en-US") : kpi.value}
              </p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Three student sources + commission rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Student sources */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              {t("agent.studentSources", "Student sources")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SourceRow
              icon={Users}
              label={t("agent.sourcePartner", "Via recruited partners")}
              hint={t("agent.sourcePartnerHint", "Students from partners in your network")}
              rate={fmt(rates.perRecruit)}
            />
            <SourceRow
              icon={Megaphone}
              label={t("agent.sourceAmbassador", "Via recruited ambassadors")}
              hint={t("agent.sourceAmbassadorHint", "Students from ambassadors in your network")}
              rate={fmt(rates.perRecruit)}
            />
            <SourceRow
              icon={Link2}
              label={t("agent.sourceSelfReferral", "Your own referrals")}
              hint={t("agent.sourceSelfReferralHint", "Students from your personal apply form")}
              rate={fmt(rates.selfReferral.effective)}
              highlight
            />
          </CardContent>
        </Card>

        {/* Earnings breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              {t("agent.earningsBreakdown", "Earnings breakdown")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {earningsBuckets.map((b) => (
                <div key={b.label} className="rounded-xl border border-border p-3">
                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2 bg-muted ${b.color}`}>
                    <b.icon className="h-4 w-4" />
                  </div>
                  <p className="text-lg font-bold">{fmt(b.value)}</p>
                  <p className="text-xs text-muted-foreground">{b.label}</p>
                </div>
              ))}
            </div>
            {earnings.has_open_request && (
              <div className="mt-3">
                <Badge variant="secondary" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {t("agent.payoutPending", "Payout request pending")}
                </Badge>
              </div>
            )}
            <Button asChild variant="outline" size="sm" className="w-full mt-3 gap-2">
              <Link to="/agent/earnings">
                {t("agent.viewEarnings", "View earnings")}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recruit link + recent recruits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recruit link */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              {t("agent.recruitLink", "Recruiting link")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t("agent.recruitLinkHint", "Share this link to recruit partners or ambassadors into your network.")}
            </p>
            {recruitUrl ? (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={recruitUrl}
                  dir="ltr"
                  className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground"
                />
                <Button variant="outline" size="icon" onClick={copyLink} aria-label={t("common.copy", "Copy")}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("agent.inviteMissing", "No recruiting link yet.")}</p>
            )}
          </CardContent>
        </Card>

        {/* Recent recruits */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">{t("agent.recentRecruits", "Recent recruits")}</CardTitle>
              <Badge variant="secondary" className="ms-auto text-xs">{recruits.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentRecruits.length === 0 ? (
              <div className="py-8 text-center">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("agent.noPartners", "No recruited partners or ambassadors yet")}</p>
                <Button asChild size="sm" className="mt-3 gap-2">
                  <Link to="/agent/recruit">
                    <UserPlus className="h-4 w-4" />
                    {t("agent.recruitCta", "Recruit")}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentRecruits.map((r) => (
                  <Link
                    key={r.partner_id}
                    to="/agent/network"
                    className="flex items-center justify-between gap-3 p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.city ? `${r.city} · ` : ""}
                        {t("agent.colStudents", "Students")}: {Number(r.students_count)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-emerald-600">{fmt(r.override_earned)}</span>
                      <Badge variant={r.status === "active" ? "default" : "secondary"} className="text-xs">
                        {r.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SourceRow({
  icon: Icon,
  label,
  hint,
  rate,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  rate: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${highlight ? "border-primary/30 bg-primary/5" : "border-border"}`}>
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${highlight ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{hint}</p>
      </div>
      <p className="text-sm font-bold text-foreground shrink-0">{rate}</p>
    </div>
  );
}
