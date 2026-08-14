import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Megaphone, Link2, Search, GraduationCap } from "lucide-react";
import { LoadingState, usePagination, TablePagination, useDebouncedValue } from "@/components/shell";
import { STATUS_COLORS } from "@/lib/caseStatus";

interface AgentStudentCase {
  id: string;
  full_name: string;
  status: string;
  created_at: string;
  source: string;
  partner_id: string | null;
  referred_by: string | null;
  source_attribution_method: string | null;
}

type SourceFilter = "all" | "partner" | "ambassador" | "self";

const fmtDate = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale);

/** Agent students: the three sources clearly distinguished.
 *  - Partner-recruited: cases where partner_id belongs to a partner in the
 *    agent's network.
 *  - Ambassador-recruited: cases where partner_id belongs to an ambassador
 *    in the agent's network.
 *  - Self-referral: cases where partner_id = agent (the agent's own apply form).
 *
 * No sensitive student details (no phone/email/address) — only first-name +
 * status + source, matching the partner students page privacy model. */
export default function AgentStudentsPage() {
  const { t, i18n } = useTranslation("dashboard");
  const { dir } = useDirection();
  const locale = i18n.language === "ar" ? "ar" : "en-US";
  const [cases, setCases] = useState<AgentStudentCase[]>([]);
  const [recruitIds, setRecruitIds] = useState<{ partners: Set<string>; ambassadors: Set<string> }>({ partners: new Set(), ambassadors: new Set() });
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (uid: string) => {
    // 1. Get the agent's network recruits (with role).
    const netRes = await (supabase as any).rpc("get_my_agent_network");
    const recruits = (netRes.data ?? []) as Array<{ partner_id: string; role: string }>;
    const partners = new Set<string>();
    const ambassadors = new Set<string>();
    for (const r of recruits) {
      if (r.role === "ambassador") ambassadors.add(r.partner_id);
      else partners.add(r.partner_id);
    }
    setRecruitIds({ partners, ambassadors });

    // 2. Fetch cases attributed to the agent's network OR to the agent directly.
    //    The agent sees cases where partner_id is one of their recruits, or
    //    partner_id = the agent themselves (self-referral).
    const allRecruitIds = [...partners, ...ambassadors, uid];
    if (allRecruitIds.length === 0) {
      setCases([]);
      setLoading(false);
      return;
    }
    const idList = allRecruitIds.join(",");
    const { data, error } = await (supabase as any)
      .from("cases")
      .select("id, full_name, status, created_at, source, partner_id, referred_by, source_attribution_method")
      .or(`partner_id.in.(${idList}),referred_by.in.(${idList})`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) console.error("agent students fetch error:", error);
    setCases((data ?? []) as AgentStudentCase[]);
    setLoading(false);
  }, []);

  const userId = useAuthedUserId(load);
  useRealtimeSubscription("cases", () => { if (userId) load(userId); }, !!userId);

  const classifySource = useCallback(
    (c: AgentStudentCase): SourceFilter => {
      const pid = c.partner_id;
      if (pid === userId) return "self";
      if (pid && recruitIds.ambassadors.has(pid)) return "ambassador";
      if (pid && recruitIds.partners.has(pid)) return "partner";
      const rid = c.referred_by;
      if (rid === userId) return "self";
      if (rid && recruitIds.ambassadors.has(rid)) return "ambassador";
      if (rid && recruitIds.partners.has(rid)) return "partner";
      return "all";
    },
    [userId, recruitIds],
  );

  const sourceLabel = (s: SourceFilter) => {
    switch (s) {
      case "partner": return t("agent.sourcePartner", "Via recruited partners");
      case "ambassador": return t("agent.sourceAmbassador", "Via recruited ambassadors");
      case "self": return t("agent.sourceSelfReferral", "Your own referrals");
      default: return t("agent.allSources", "All sources");
    }
  };

  const statusLabel = (s: string) => t(`partner.status.${s}`, { defaultValue: s });

  const firstNameOnly = (full: string) => full?.split(" ")[0] || "—";

  const counts = useMemo(() => {
    const c = { all: cases.length, partner: 0, ambassador: 0, self: 0 };
    for (const cs of cases) {
      const s = classifySource(cs);
      if (s === "partner") c.partner++;
      else if (s === "ambassador") c.ambassador++;
      else if (s === "self") c.self++;
    }
    return c;
  }, [cases, classifySource]);

  const filtered = useMemo(() => cases.filter((c) => {
    const matchSearch = !debouncedSearch || firstNameOnly(c.full_name).toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchSource = sourceFilter === "all" || classifySource(c) === sourceFilter;
    return matchSearch && matchSource;
  }), [cases, debouncedSearch, sourceFilter, classifySource]);

  const pagination = usePagination(filtered, 25);

  if (!userId || loading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
        <LoadingState variant="table" rows={6} label={t("common.loading", "Loading")} />
      </div>
    );
  }

  const sourceIcons: Record<SourceFilter, React.ComponentType<{ className?: string }>> = {
    all: GraduationCap,
    partner: Users,
    ambassador: Megaphone,
    self: Link2,
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          {t("agent.studentsTitle", "Students")}
          <span className="text-base font-normal text-muted-foreground">({cases.length})</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("agent.studentsSubtitle", "Students generated through your network and personal referrals.")}
        </p>
      </div>

      {/* Source filter chips */}
      <div className="flex flex-wrap gap-2">
        {(["all", "partner", "ambassador", "self"] as SourceFilter[]).map((s) => {
          const Icon = sourceIcons[s];
          return (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                sourceFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {sourceLabel(s)} ({counts[s]})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("partner.searchByFirstName", "Search by first name")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {/* Student list (card-based for mobile, table for desktop) */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <GraduationCap className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            {search || sourceFilter !== "all"
              ? t("partner.noMatchingStudents", "No matching students")
              : t("agent.noStudents", "No students yet")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{t("partner.colName", "Name")}</th>
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{t("agent.colSource", "Source")}</th>
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{t("partner.colStage", "Stage")}</th>
                    <th className="text-start text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{t("partner.colDate", "Date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.items.map((c) => {
                    const src = classifySource(c);
                    return (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap max-w-[140px] truncate">{firstNameOnly(c.full_name)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{sourceLabel(src)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge className={`text-xs w-fit ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}>{statusLabel(c.status)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(c.created_at, locale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-border">
              {pagination.items.map((c) => {
                const src = classifySource(c);
                return (
                  <div key={c.id} className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{firstNameOnly(c.full_name)}</p>
                      <Badge className={`text-xs ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}>{statusLabel(c.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{sourceLabel(src)} · {fmtDate(c.created_at, locale)}</p>
                  </div>
                );
              })}
            </div>
            <TablePagination pagination={pagination} />
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">{t("partner.privacyNote", "Student personal details are protected.")}</p>
    </div>
  );
}
