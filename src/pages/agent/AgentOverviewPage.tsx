import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
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
import {
  PageHeader,
  KpiRow,
  SectionCard,
  EmptyState,
  LoadingState,
  type KpiItem,
} from "@/components/shell";
import { toneClasses } from "@/lib/statusTokens";
import { useAgentOverview } from "@/hooks/useAgentOverview";

const fmt = (n: number) => `₪${Number(n || 0).toLocaleString("en-US")}`;
const fmtCount = (n: number) => Number(n || 0).toLocaleString("en-US");

/**
 * Agent overview — composed from the shared dashboard shell primitives so it
 * matches the Team / Partner / Ambassador dashboards exactly (same header,
 * same KPI tiles, same section cards) and adapts to light / dark / aurora via
 * semantic tokens only.
 */
export default function AgentOverviewPage() {
  const { t } = useTranslation("dashboard");
  const { dir } = useDirection();
  const { profile, recruits, stats, rates, earnings, loading, refetch } = useAgentOverview();

  useRealtimeSubscription("rewards", () => refetch(), !!profile);
  useRealtimeSubscription("profiles", () => refetch(), !!profile);

  const [copiedRecruit, setCopiedRecruit] = React.useState(false);
  const [copiedAmbassador, setCopiedAmbassador] = React.useState(false);
  const [copiedApply, setCopiedApply] = React.useState(false);
  const recruitUrl = profile?.recruit_code
    ? `${window.location.origin}/join/${profile.recruit_code}`
    : "";
  const ambassadorUrl = profile?.ambassador_recruit_code
    ? `${window.location.origin}/join/${profile.ambassador_recruit_code}`
    : "";
  // The referral apply link only resolves while the admin toggle
  // (profiles.referral_code_enabled) is on — don't hand out a dead link.
  const referralEnabled = profile?.referral_code_enabled !== false;
  const applyUrl = profile?.referral_code && referralEnabled
    ? `${window.location.origin}/apply?ref=${encodeURIComponent(profile.referral_code)}`
    : "";

  const copyLink = async (url: string, which: "recruit" | "ambassador" | "apply") => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      if (which === "recruit") {
        setCopiedRecruit(true);
        setTimeout(() => setCopiedRecruit(false), 1500);
      } else if (which === "ambassador") {
        setCopiedAmbassador(true);
        setTimeout(() => setCopiedAmbassador(false), 1500);
      } else {
        setCopiedApply(true);
        setTimeout(() => setCopiedApply(false), 1500);
      }
    } catch { /* clipboard may be unavailable */ }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto" dir={dir}>
        <LoadingState variant="kpi" />
      </div>
    );
  }

  const kpis: KpiItem[] = [
    {
      key: "partners",
      label: t("agent.ovRecruitedPartners", "Recruited partners"),
      value: fmtCount(stats.totalPartners),
      icon: Users,
    },
    {
      key: "ambassadors",
      label: t("agent.ovRecruitedAmbassadors", "Recruited ambassadors"),
      value: fmtCount(stats.totalAmbassadors),
      icon: Megaphone,
    },
    {
      key: "students",
      label: t("agent.ovTotalStudents", "Total students"),
      value: fmtCount(stats.totalStudents),
      icon: GraduationCap,
    },
    {
      key: "enrolled",
      label: t("agent.ovPaidCases", "Paid cases"),
      value: fmtCount(stats.enrolledCases),
      icon: Award,
      tone: toneClasses("enrolled").text,
    },
  ];

  const funnelKpis: KpiItem[] = [
    {
      key: "direct",
      label: t("agent.kpiDirectStudents", "Direct referrals"),
      value: fmtCount(stats.directStudents),
      icon: Link2,
    },
    {
      key: "viaPartners",
      label: t("agent.kpiPartnerStudents", "Via partners"),
      value: fmtCount(stats.partnerStudents),
      icon: Users,
    },
    {
      key: "viaAmbassadors",
      label: t("agent.kpiAmbassadorStudents", "Via ambassadors"),
      value: fmtCount(stats.ambassadorStudents),
      icon: Megaphone,
    },
    {
      key: "submitted",
      label: t("agent.kpiSubmitted", "Submitted"),
      value: fmtCount(stats.submittedCases),
      icon: TrendingUp,
      tone: toneClasses("submitted").text,
    },
    {
      key: "conversion",
      label: t("agent.kpiConversion", "Conversion"),
      value: `${stats.conversionRate}%`,
      icon: Award,
    },
  ];

  // Activity KPIs — these are already computed by get_my_agent_kpis
  // (cases_new, cases_last_30d, members_active) and exposed via the shared
  // hook (stats.newCases, stats.casesLast30d, stats.activeRecruits). Surfacing
  // them adds no extra DB cost.
  const activityKpis: KpiItem[] = [
    {
      key: "newCases",
      label: t("agent.kpiNewCases", "New cases"),
      value: fmtCount(stats.newCases),
      icon: TrendingUp,
    },
    {
      key: "last30d",
      label: t("agent.kpiLast30d", "Cases (30d)"),
      value: fmtCount(stats.casesLast30d),
      icon: Award,
    },
    {
      key: "activeRecruits",
      label: t("agent.kpiActiveRecruits", "Active recruits"),
      value: fmtCount(stats.activeRecruits),
      icon: Users,
    },
  ];


  const earningsBuckets: KpiItem[] = [
    {
      key: "available",
      label: t("agent.earningsAvailable", "Available"),
      value: fmt(earnings.available),
      icon: Wallet,
      tone: toneClasses("enrolled").text,
    },
    {
      key: "locked",
      label: t("agent.earningsLocked", "Locked"),
      value: fmt(earnings.locked),
      icon: HandCoins,
      tone: toneClasses("payment").text,
    },
    {
      key: "requested",
      label: t("agent.earningsRequested", "Requested"),
      value: fmt(earnings.requested),
      icon: TrendingUp,
      tone: toneClasses("submitted").text,
    },
    {
      key: "paid",
      label: t("agent.earningsPaid", "Paid"),
      value: fmt(earnings.paid),
      icon: Award,
      tone: toneClasses("contacted").text,
    },
  ];

  const recentRecruits = [...recruits]
    .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto" dir={dir}>
      <PageHeader
        title={`${t("agent.welcome", "Welcome")}${profile?.full_name ? `, ${profile.full_name}` : ""}`}
        subtitle={t("agent.subtitle", "Agent dashboard")}
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/agent/network?tab=recruit">
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
          </>
        }
      />

      <div className="space-y-4">
        {/* Total earnings */}
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {t("agent.totalEarnings", "Total earnings")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("agent.earningsBannerHint", "Override commissions from your recruited network + self-referrals.")}
              </p>
              {earnings.paid > 0 && (
                <p className={`mt-1 text-xs font-medium ${toneClasses("enrolled").text}`}>
                  {t("agent.paidOut", { amount: fmtCount(earnings.paid) })}
                </p>
              )}
            </div>
            <p className={`min-w-0 truncate text-2xl font-bold tabular-nums ${toneClasses('payment').text} sm:text-3xl ${earnings.total ? 'neon-kpi neon-warning' : ''}`}>
              {fmt(earnings.total)}
            </p>
          </div>
        </SectionCard>

        <KpiRow items={kpis} columns={4} />
        <KpiRow items={funnelKpis} columns={4} />
        <KpiRow items={activityKpis} columns={3} />


        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Student sources */}
          <SectionCard
            title={t("agent.studentSources", "Student sources")}
            icon={GraduationCap}
          >
            <div className="space-y-2">
              {/* Partners and ambassadors share the same per-recruit override
                  rate (both render `rates.perRecruit`), so collapse them into
                  one row to avoid showing identical values that imply
                  differentiated rates. */}
              <SourceRow
                icon={Users}
                label={t("agent.sourceNetwork", "Via your network")}
                hint={t("agent.sourceNetworkHint", "Partners and ambassadors you recruited")}
                rate={fmt(rates.perRecruit)}
              />
              <SourceRow
                icon={Link2}
                label={t("agent.sourceSelfReferral", "Your own referrals")}
                hint={t("agent.sourceSelfReferralHint", "Students from your personal apply form")}
                rate={fmt(rates.selfReferral.effective)}
                highlight
              />
            </div>
          </SectionCard>

          {/* Earnings breakdown */}
          <SectionCard
            title={t("agent.earningsBreakdown", "Earnings breakdown")}
            icon={Wallet}
            actions={
              earnings.has_open_request ? (
                <Badge variant="secondary" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {t("agent.payoutPending", "Payout request pending")}
                </Badge>
              ) : undefined
            }
          >
            <KpiRow items={earningsBuckets} columns={2} />
            <Button asChild variant="outline" size="sm" className="mt-3 w-full gap-2">
              <Link to="/agent/earnings">
                {t("agent.viewEarnings", "View earnings")}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Your links */}
          <SectionCard title={t("agent.yourLinks", "Your links")} icon={Link2}>
            <p className="text-xs text-muted-foreground">
              {t("agent.yourLinksHint", "Share these links to recruit partners, ambassadors, or to refer students.")}
            </p>

            {/* Partner recruiting link */}
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-medium text-foreground">
                {t("agent.recruitPartnerLink", "Partner recruiting link")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("agent.recruitPartnerLinkHint", "Share this link to recruit partners into your network.")}
              </p>
              {recruitUrl ? (
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={recruitUrl}
                    dir="ltr"
                    aria-label={t("agent.recruitPartnerLink", "Partner recruiting link")}
                    className="min-w-0 flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyLink(recruitUrl, "recruit")}
                    aria-label={t("common.copy", "Copy")}
                  >
                    {copiedRecruit ? (
                      <Check className={`h-4 w-4 ${toneClasses("enrolled").text}`} />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("agent.inviteMissing", "No recruiting link yet.")}
                </p>
              )}
            </div>

            {/* Ambassador recruiting link */}
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-medium text-foreground">
                {t("agent.recruitAmbassadorLink", "Ambassador recruiting link")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("agent.recruitAmbassadorLinkHint", "Share this link to recruit ambassadors into your network.")}
              </p>
              {ambassadorUrl ? (
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={ambassadorUrl}
                    dir="ltr"
                    aria-label={t("agent.recruitAmbassadorLink", "Ambassador recruiting link")}
                    className="min-w-0 flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyLink(ambassadorUrl, "ambassador")}
                    aria-label={t("common.copy", "Copy")}
                  >
                    {copiedAmbassador ? (
                      <Check className={`h-4 w-4 ${toneClasses("enrolled").text}`} />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("agent.ambassadorLinkMissing", "No ambassador link yet.")}
                </p>
              )}
            </div>

            {/* Referral apply form link */}
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-medium text-foreground">
                {t("agent.applyLink", "Referral apply form")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("agent.applyLinkHint", "Share this link with students. Applications submitted through it are attributed to you.")}
              </p>
              {applyUrl ? (
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={applyUrl}
                    dir="ltr"
                    aria-label={t("agent.applyLink", "Referral apply form")}
                    className="min-w-0 flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyLink(applyUrl, "apply")}
                    aria-label={t("common.copy", "Copy")}
                  >
                    {copiedApply ? (
                      <Check className={`h-4 w-4 ${toneClasses("enrolled").text}`} />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : profile?.referral_code && !referralEnabled ? (
                <p className="text-xs text-muted-foreground">
                  {t("agent.applyLinkDisabled", "Your referral link is currently disabled. Please contact the Darb team to reactivate it.")}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("agent.applyLinkMissing", "No referral link yet.")}
                </p>
              )}
            </div>
          </SectionCard>

          {/* Recent recruits */}
          <SectionCard
            title={t("agent.recentRecruits", "Recent recruits")}
            icon={Users}
            actions={<Badge variant="secondary" className="text-xs">{recruits.length}</Badge>}
            flush
          >
            {recentRecruits.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t("agent.noPartners", "No recruited partners or ambassadors yet")}
                action={
                  <Button asChild size="sm" className="gap-2">
                    <Link to="/agent/network?tab=recruit">
                      <UserPlus className="h-4 w-4" />
                      {t("agent.recruitCta", "Recruit")}
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-border/60">
                {recentRecruits.map((r) => (
                  <Link
                    key={r.partner_id}
                    to="/agent/network"
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.city ? `${r.city} · ` : ""}
                        {t("agent.colStudents", "Students")}: {Number(r.students_count)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`text-xs font-semibold tabular-nums ${toneClasses("enrolled").text}`}>
                        {fmt(r.override_earned)}
                      </span>
                      <Badge
                        variant={r.status === "active" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {r.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
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
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        highlight ? "border-primary/30 bg-primary/5" : "border-border/70 bg-card"
      }`}
    >
      <div
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          highlight ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{rate}</p>
    </div>
  );
}
