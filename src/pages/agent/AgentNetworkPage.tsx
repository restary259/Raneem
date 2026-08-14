import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Users, Search, UserPlus, ChevronRight, Award, GraduationCap, TrendingUp, Mail, MapPin } from "lucide-react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { useAgentOverview, type AgentRecruit } from "@/hooks/useAgentOverview";

const fmt = (n: number) => `₪${Number(n || 0).toLocaleString("en-US")}`;

type Tab = "all" | "partners" | "ambassadors" | "active" | "pending";

/** Agent network: a premium, tabbed management view of the partners &
 *  ambassadors the agent recruited. Tabs: All / Partners / Ambassadors /
 *  Active / Pending. Clicking a recruit opens a side sheet with their
 *  analytics (students, paid cases, override earned, join date). */
export default function AgentNetworkPage() {
  const { t, i18n } = useTranslation("dashboard");
  const { dir } = useDirection();
  const locale = i18n.language === "ar" ? "ar" : "en-US";
  const { recruits, loading, refetch } = useAgentOverview();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<AgentRecruit | null>(null);

  useRealtimeSubscription("profiles", () => refetch(), true);
  useRealtimeSubscription("rewards", () => refetch(), true);

  const counts = useMemo(() => ({
    all: recruits.length,
    partners: recruits.filter((r) => !r.role || r.role === "social_media_partner").length,
    ambassadors: recruits.filter((r) => r.role === "ambassador").length,
    active: recruits.filter((r) => r.status === "active").length,
    pending: recruits.filter((r) => r.status !== "active").length,
  }), [recruits]);

  const filtered = recruits.filter((r) => {
    const matchSearch = !search || r.full_name.toLowerCase().includes(search.toLowerCase());
    let matchTab = true;
    if (tab === "partners") matchTab = !r.role || r.role === "social_media_partner";
    else if (tab === "ambassadors") matchTab = r.role === "ambassador";
    else if (tab === "active") matchTab = r.status === "active";
    else if (tab === "pending") matchTab = r.status !== "active";
    return matchSearch && matchTab;
  });

  if (loading) return <DashboardLoading />;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: t("agent.tabAll", "All"), count: counts.all },
    { key: "partners", label: t("agent.tabPartners", "Partners"), count: counts.partners },
    { key: "ambassadors", label: t("agent.tabAmbassadors", "Ambassadors"), count: counts.ambassadors },
    { key: "active", label: t("agent.tabActive", "Active"), count: counts.active },
    { key: "pending", label: t("agent.tabPending", "Pending"), count: counts.pending },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {t("agent.networkTitle", "My network")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("agent.networkSubtitle", "Partners & ambassadors you recruited and the override they generate.")}
          </p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link to="/agent/recruit">
            <UserPlus className="h-4 w-4" />
            {t("agent.recruitCta", "Recruit")}
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              tab === tb.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {tb.label} ({tb.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder={t("agent.searchRecruits", "Search by name")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-9 pe-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Recruit list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search || tab !== "all"
                ? t("agent.noMatchingRecruits", "No matching recruits")
                : t("agent.noPartners", "No recruited partners or ambassadors yet")}
            </p>
            <Button asChild size="sm" className="mt-3 gap-2">
              <Link to="/agent/recruit">
                <UserPlus className="h-4 w-4" />
                {t("agent.recruitCta", "Recruit")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{t("agent.colName", "Name")}</th>
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{t("agent.colRole", "Role")}</th>
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{t("agent.colStudents", "Students")}</th>
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{t("agent.colPaid", "Paid")}</th>
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{t("agent.colOverride", "Override")}</th>
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{t("agent.colStatus", "Status")}</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.partner_id}
                      onClick={() => setSelected(r)}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap max-w-[160px] truncate">{r.full_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant="outline" className="text-xs">
                          {r.role === "ambassador" ? t("agent.roleAmbassador", "Ambassador") : t("agent.rolePartner", "Partner")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{Number(r.students_count)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{Number(r.paid_cases)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-emerald-600">{fmt(r.override_earned)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={r.status === "active" ? "default" : "secondary"} className="text-xs">{r.status}</Badge>
                      </td>
                      <td className="px-2"><ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-border">
              {filtered.map((r) => (
                <button
                  key={r.partner_id}
                  onClick={() => setSelected(r)}
                  className="w-full p-4 text-start hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{r.full_name}</p>
                    <Badge variant={r.status === "active" ? "default" : "secondary"} className="text-xs shrink-0">{r.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {r.role === "ambassador" ? t("agent.roleAmbassador", "Ambassador") : t("agent.rolePartner", "Partner")}
                      {" · "}{t("agent.colStudents", "Students")}: {Number(r.students_count)}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600">{fmt(r.override_earned)}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail sheet */}
      <RecruitDetailSheet recruit={selected} onClose={() => setSelected(null)} locale={locale} />
    </div>
  );
}

function RecruitDetailSheet({ recruit, onClose, locale }: { recruit: AgentRecruit | null; onClose: () => void; locale: string }) {
  const { t } = useTranslation("dashboard");
  const { dir } = useDirection();

  const stats = recruit ? [
    { label: t("agent.colStudents", "Students"), value: Number(recruit.students_count), icon: GraduationCap },
    { label: t("agent.colPaid", "Paid cases"), value: Number(recruit.paid_cases), icon: Award },
    { label: t("agent.colOverride", "Override earned"), value: fmt(recruit.override_earned), icon: TrendingUp },
  ] : [];

  return (
    <Sheet open={!!recruit} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md overflow-y-auto">
        {recruit && (
          <>
            <SheetHeader>
              <SheetTitle className="text-lg">{recruit.full_name}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6 space-y-4">
              {/* Badges */}
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {recruit.role === "ambassador" ? t("agent.roleAmbassador", "Ambassador") : t("agent.rolePartner", "Partner")}
                </Badge>
                <Badge variant={recruit.status === "active" ? "default" : "secondary"}>{recruit.status}</Badge>
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                {recruit.city && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {recruit.city}
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate" dir="ltr">{recruit.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {t("agent.joinedOn", "Joined")} {new Date(recruit.joined_at).toLocaleDateString(locale)}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-border p-3 text-center">
                    <s.icon className="h-4 w-4 mx-auto text-primary mb-1" />
                    <p className="text-sm font-bold">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Referral code */}
              {recruit.referral_code && (
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">{t("agent.referralCode", "Referral code")}</p>
                  <p className="font-mono text-sm font-bold" dir="ltr">{recruit.referral_code}</p>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}