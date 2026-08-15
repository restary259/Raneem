import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { useDirection } from "@/hooks/useDirection";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Megaphone, Link2, Search, GraduationCap, HelpCircle } from "lucide-react";
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
  /** Server-attributed source from get_my_agent_students. */
  src: "self" | "partner" | "ambassador" | "unknown";
}

type SourceFilter = "all" | "partner" | "ambassador" | "self" | "unknown";

const fmtDate = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale);

/** Agent students: cases attributable to the agent, fetched in full from the
 *  `get_my_agent_students` RPC (no client-side truncation) with a
 *  server-computed `src` column so every row is attributed. No sensitive
 *  student details (no phone/email/address) — only first-name + status +
 *  source, matching the partner students page privacy model. */
export default function AgentStudentsPage() {
  const { t, i18n } = useTranslation("dashboard");
  const { dir } = useDirection();
  const locale = i18n.language === "ar" ? "ar" : "en-US";
  const [cases, setCases] = useState<AgentStudentCase[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Single RPC: complete case list with server-attributed `src`.
    // Replaces the previous two-step fetch (network RPC + direct cases query
    // with a hard .limit(200)) and the client-side classifySource() fallthrough.
    const { data, error } = await (supabase as any).rpc("get_my_agent_students");
    if (error) console.error("agent students fetch error:", error);
    setCases((data ?? []) as AgentStudentCase[]);
    setLoading(false);
  }, []);

  const userId = useAuthedUserId(() => { load(); });
  useRealtimeSubscription("cases", () => { load(); }, !!userId);

  const sourceLabel = (s: SourceFilter) => {
    switch (s) {
      case "partner": return t("agent.sourcePartner", "Via recruited partners");
      case "ambassador": return t("agent.sourceAmbassador", "Via recruited ambassadors");
      case "self": return t("agent.sourceSelfReferral", "Your own referrals");
      case "unknown": return t("agent.sourceUnattributed", "Unattributed");
      default: return t("agent.allSources", "All sources");
    }
  };

  const statusLabel = (s: string) => t(`partner.status.${s}`, { defaultValue: s });

  const firstNameOnly = (full: string) => full?.split(" ")[0] || "—";

  const counts = useMemo(() => {
    const c = { all: cases.length, partner: 0, ambassador: 0, self: 0, unknown: 0 };
    for (const cs of cases) {
      if (cs.src === "partner") c.partner++;
      else if (cs.src === "ambassador") c.ambassador++;
      else if (cs.src === "self") c.self++;
      else if (cs.src === "unknown") c.unknown++;
    }
    return c;
  }, [cases]);

  const filtered = useMemo(() => cases.filter((c) => {
    const matchSearch = !debouncedSearch || firstNameOnly(c.full_name).toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchSource = sourceFilter === "all" || c.src === sourceFilter;
    return matchSearch && matchSource;
  }), [cases, debouncedSearch, sourceFilter]);

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
    unknown: HelpCircle,
  };

  const chipFilters: SourceFilter[] = counts.unknown > 0
    ? ["all", "partner", "ambassador", "self", "unknown"]
    : ["all", "partner", "ambassador", "self"];

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
        {chipFilters.map((s) => {
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
                  {pagination.items.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap max-w-[140px] truncate">{firstNameOnly(c.full_name)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{sourceLabel(c.src)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={`text-xs w-fit ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}>{statusLabel(c.status)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(c.created_at, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-border">
              {pagination.items.map((c) => (
                <div key={c.id} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{firstNameOnly(c.full_name)}</p>
                    <Badge className={`text-xs ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}>{statusLabel(c.status)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{sourceLabel(c.src)} · {fmtDate(c.created_at, locale)}</p>
                </div>
              ))}
            </div>
            <TablePagination pagination={pagination} />
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">{t("partner.privacyNote", "Student personal details are protected.")}</p>
    </div>
  );
}
