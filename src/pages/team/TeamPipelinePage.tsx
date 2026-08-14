import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useIsManager } from "@/hooks/useIsManager";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  RefreshCw,
  Search,
  UserCheck,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  MessageCircle,
  Phone,
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  Rows3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import {
  CaseStatus,
  CASE_STATUS_ORDER,
  CASE_STATUS_LABELS,
  resolveStatus,
  statusIndex,
  isActiveStatus,
} from "@/lib/caseStatus";
import { SLA_DAYS, slaSummary } from "@/lib/slaPolicy";
import { CaseCard, CaseStatusChip } from "@/components/cases/CaseVisuals";
import { toneClasses, toneForAttention } from "@/lib/statusTokens";

interface PipelineCase {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  source: string;
  assigned_to: string | null;
  partner_id: string | null;
  created_at: string;
  last_activity_at: string | null;
  archived: boolean;
}

interface TeamDirMember {
  id: string;
  full_name: string;
}

/** Active pipeline stages shown as filter pills (matches the prototype order). */
const STAGE_PILLS = [
  CaseStatus.NEW,
  CaseStatus.CONTACTED,
  CaseStatus.APPT_SCHEDULED,
  CaseStatus.PROFILE_COMPLETION,
  CaseStatus.PAYMENT_CONFIRMED,
  CaseStatus.SUBMITTED,
];

type AttnLevel = "normal" | "warn" | "overdue";

const daysSince = (iso: string | null) => {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
};

/**
 * Manager combined pipeline: a single table-based view of all active cases
 * (the manager's primary "cases" surface), with quick filters, stage pills,
 * next-action + owner + SLA/attention columns, and a right-side detail drawer
 * whose only write action is assigning `assigned_to` (RLS +
 * `enforce_manager_assign_only` restrict managers to that column). Edit/Delete
 * are intentionally NOT exposed. Non-managers are bounced to /team.
 */
const TeamPipelinePage: React.FC = () => {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isManager, loading: mgrLoading } = useIsManager();
  const isAr = i18n.language === "ar";

  const [cases, setCases] = useState<PipelineCase[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamDirMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | "mine" | "unassigned" | "action" | "overdue" | "referrals">("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "attn", dir: "desc" });

  const [view, setView] = useState<"list" | "board">("list");
  const [selected, setSelected] = useState<PipelineCase | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Manager sees ALL active (non-archived) cases via RLS — broader than the
      // old partner_id-only list. "Referrals only" is a client quick-filter.
      const [caseRes, teamRes] = await Promise.all([
        supabase
          .from("cases")
          .select(
            "id, full_name, phone_number, status, source, assigned_to, partner_id, created_at, last_activity_at, archived",
          )
          .eq("archived", false)
          .not("status", "in", '("forgotten","cancelled","enrollment_paid")')
          .order("last_activity_at", { ascending: false, nullsFirst: false }),
        supabase.rpc("list_team_directory"),
      ]);
      if (caseRes.error) throw caseRes.error;
      setCases((caseRes.data as PipelineCase[]) ?? []);
      setTeamMembers((teamRes.data as TeamDirMember[]) ?? []);
    } catch (err: unknown) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (mgrLoading) return;
    if (!isManager) {
      navigate("/team", { replace: true });
      return;
    }
    fetchData();
  }, [mgrLoading, isManager, navigate, fetchData]);

  useRealtimeSubscription("cases", fetchData, true);

  const assigneeName = useCallback(
    (id: string | null) => (id ? teamMembers.find((tm) => tm.id === id)?.full_name ?? null : null),
    [teamMembers],
  );

  // SLA / attention level — mirrors AdminPipelinePage's isRedStale/isOrangeStale
  // using the shared SLA_DAYS thresholds keyed by CaseStatus.
  const attnFor = useCallback((c: PipelineCase): AttnLevel => {
    const status = resolveStatus(c.status);
    const days = daysSince(c.last_activity_at ?? c.created_at);
    const red =
      (status === CaseStatus.NEW && days >= SLA_DAYS[CaseStatus.NEW]) ||
      (status === CaseStatus.CONTACTED && days >= SLA_DAYS[CaseStatus.CONTACTED]) ||
      (status === CaseStatus.APPT_SCHEDULED && days >= SLA_DAYS[CaseStatus.APPT_SCHEDULED]) ||
      (status === CaseStatus.PROFILE_COMPLETION && days >= SLA_DAYS[CaseStatus.PROFILE_COMPLETION]);
    if (red) return "overdue";
    // Amber/attention when an SLA threshold exists for this stage and the case
    // is at/over half of it (a soft "needs attention" signal).
    const threshold = SLA_DAYS[status];
    if (threshold && days >= Math.ceil(threshold / 2)) return "warn";
    return "normal";
  }, []);

  const nextActionFor = useCallback(
    (c: PipelineCase): string => {
      const status = resolveStatus(c.status);
      switch (status) {
        case CaseStatus.NEW:
          return t("manager.nextNew", "First contact");
        case CaseStatus.CONTACTED:
          return t("manager.nextAppt", "Schedule appointment");
        case CaseStatus.APPT_SCHEDULED:
          return t("manager.nextApptResult", "Record appointment result");
        case CaseStatus.PROFILE_COMPLETION:
          return t("manager.nextProfile", "Complete student profile");
        case CaseStatus.PAYMENT_CONFIRMED:
          return t("manager.nextPayment", "Confirm payment received");
        case CaseStatus.SUBMITTED:
          return t("manager.nextReview", "Awaiting admin review");
        default:
          return t("manager.nextComplete", "Completed");
      }
    },
    [t],
  );

  const attnWeight = (c: PipelineCase) =>
    attnFor(c) === "overdue" ? 2 : attnFor(c) === "warn" ? 1 : 0;

  type SortKey = "name" | "stage" | "action" | "owner" | "attn" | "time";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = cases.filter((c) => {
      if (!isActiveStatus(c.status)) return false;
      if (q && !c.full_name.toLowerCase().includes(q) && !c.phone_number.includes(q)) return false;
      if (stageFilter !== "all" && resolveStatus(c.status) !== stageFilter) return false;
      switch (quickFilter) {
        case "mine":
          // "Mine" = assigned to someone (any team member). The manager is a
          // triage role; this surfaces cases already in flight.
          if (!c.assigned_to) return false;
          break;
        case "unassigned":
          if (c.assigned_to) return false;
          break;
        case "action":
          if (attnFor(c) === "normal") return false;
          break;
        case "overdue":
          if (attnFor(c) !== "overdue") return false;
          break;
        case "referrals":
          if (!c.partner_id) return false;
          break;
      }
      return true;
    });

    rows.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sort.key) {
        case "attn":
          av = attnWeight(a);
          bv = attnWeight(b);
          break;
        case "name":
          av = a.full_name.toLowerCase();
          bv = b.full_name.toLowerCase();
          break;
        case "stage":
          av = statusIndex(a.status);
          bv = statusIndex(b.status);
          break;
        case "owner":
          av = assigneeName(a.assigned_to) ?? "zzz";
          bv = assigneeName(b.assigned_to) ?? "zzz";
          break;
        case "time":
          av = new Date(a.last_activity_at ?? a.created_at).getTime();
          bv = new Date(b.last_activity_at ?? b.created_at).getTime();
          break;
        default:
          av = 0;
          bv = 0;
      }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [cases, search, stageFilter, quickFilter, sort, attnFor, assigneeName]);

  const counts = useMemo(() => {
    const c = { all: cases.length, mine: 0, unassigned: 0, action: 0, overdue: 0, referrals: 0 };
    for (const k of cases) {
      if (k.assigned_to) c.mine++;
      else c.unassigned++;
      if (attnFor(k) !== "normal") c.action++;
      if (attnFor(k) === "overdue") c.overdue++;
      if (k.partner_id) c.referrals++;
    }
    return c;
  }, [cases, attnFor]);

  const assignCase = async (caseId: string, userId: string | null) => {
    setAssigning(caseId);
    try {
      // Only assigned_to is touched; RLS restricts the UPDATE to that column.
      const { error } = await supabase
        .from("cases")
        .update({ assigned_to: userId || null })
        .eq("id", caseId);
      if (error) throw error;
      setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, assigned_to: userId } : c)));
      setSelected((prev) => (prev && prev.id === caseId ? { ...prev, assigned_to: userId } : prev));
      toast({ description: t("admin.pipeline.caseAssigned", "Case assigned successfully") });
    } catch (err: unknown) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "" });
    } finally {
      setAssigning(null);
    }
  };

  const openDrawer = (c: PipelineCase) => {
    setSelected(c);
    setSheetOpen(true);
  };

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  if (mgrLoading) return <DashboardLoading label={t("common.loading", "Loading…")} />;

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const SortArrow = ({ k }: { k: SortKey }) =>
    sort.key === k ? (
      sort.dir === "asc" ? (
        <ChevronUp className="h-3 w-3 inline ms-0.5" />
      ) : (
        <ChevronDown className="h-3 w-3 inline ms-0.5" />
      )
    ) : null;

  const quickFilters: { key: typeof quickFilter; label: string; count: number; danger?: boolean }[] = [
    { key: "all", label: t("manager.qfAll", "All"), count: counts.all },
    { key: "mine", label: t("manager.qfMine", "Mine"), count: counts.mine },
    { key: "unassigned", label: t("manager.qfUnassigned", "Unassigned"), count: counts.unassigned },
    { key: "action", label: t("manager.qfAction", "Needs action"), count: counts.action },
    { key: "overdue", label: t("manager.qfOverdue", "Overdue"), count: counts.overdue, danger: true },
    { key: "referrals", label: t("manager.qfReferrals", "Referrals only"), count: counts.referrals },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" />
            {t("manager.pipelineTitle", "Pipeline")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("manager.pipelineSubtitleCombined", "Triage and assign active cases to your team.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {([
              { key: "list" as const, icon: Rows3, label: t("manager.viewList", "List") },
              { key: "board" as const, icon: LayoutGrid, label: t("manager.viewBoard", "Board") },
            ]).map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                aria-pressed={view === v.key}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  view === v.key
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <v.icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh", "Refresh")}
          </Button>
        </div>
      </div>

      {/* Controls: search + quick filters + stage pills */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ltr:left-3 rtl:right-3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("manager.searchPlaceholder", "Search by name or phone…")}
              className="ltr:pl-9 rtl:pr-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setQuickFilter(f.key)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  quickFilter === f.key
                    ? f.danger
                      ? "bg-destructive/15 border-destructive text-destructive"
                      : "bg-primary/15 border-primary text-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {f.label}
                <span className="bg-background/60 rounded-full px-1.5 text-[10px]">{f.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stage pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setStageFilter("all")}
            className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
              stageFilter === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("manager.stageAll", "All")}
          </button>
          {STAGE_PILLS.map((s) => {
            const meta = CASE_STATUS_LABELS[s];
            return (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                  stageFilter === s
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {isAr ? meta.ar : meta.en}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cases — list (table) or board (stage columns) */}
      {loading ? (
        <DashboardLoading label={t("common.loading", "Loading…")} />
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          {t("manager.noCases", "No partner/ambassador cases to assign right now.")}
        </Card>
      ) : view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGE_PILLS.map((stage) => {
            const column = filtered.filter((c) => resolveStatus(c.status) === stage);
            const meta = CASE_STATUS_LABELS[stage];
            return (
              <div key={stage} className="w-[16rem] shrink-0 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <CaseStatusChip status={stage} label={isAr ? meta.ar : meta.en} size="xs" />
                  <span className="text-xs font-medium text-muted-foreground">{column.length}</span>
                </div>
                <div className="space-y-2">
                  {column.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                      {t("manager.emptyStage", "Nothing here")}
                    </div>
                  ) : (
                    column.map((c) => {
                      const attn = attnFor(c);
                      const owner = assigneeName(c.assigned_to);
                      const sla = slaSummary(c.status, c.last_activity_at ?? c.created_at);
                      return (
                        <CaseCard key={c.id} status={stage} onClick={() => openDrawer(c)}>
                          <p className="truncate text-sm font-semibold text-foreground">{c.full_name}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
                            {c.phone_number}
                          </p>
                          <div className="mt-2 flex items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneClasses(toneForAttention(attn)).dot}`}
                              aria-hidden
                            />
                            <span className="truncate text-[12px] text-muted-foreground">
                              {nextActionFor(c)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] text-muted-foreground">
                              {owner ?? (
                                <span className="font-semibold text-destructive">
                                  {t("manager.unassigned", "Unassigned")}
                                </span>
                              )}
                            </span>
                            {attn !== "normal" && (
                              <span
                                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  toneClasses(toneForAttention(attn)).chip
                                }`}
                              >
                                {attn === "overdue" && <AlertTriangle className="h-3 w-3" />}
                                {sla ??
                                  (attn === "overdue"
                                    ? t("manager.overdue", "Overdue")
                                    : t("manager.needsAttention", "Needs attention"))}
                              </span>
                            )}
                          </div>
                        </CaseCard>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card shadow-surface">

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th
                    className="text-start font-semibold text-[11px] uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-foreground whitespace-nowrap"
                    onClick={() => toggleSort("name")}
                  >
                    {t("manager.colStudent", "Student")}
                    <SortArrow k="name" />
                  </th>
                  <th
                    className="text-start font-semibold text-[11px] uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-foreground whitespace-nowrap"
                    onClick={() => toggleSort("stage")}
                  >
                    {t("manager.colStage", "Stage")}
                    <SortArrow k="stage" />
                  </th>
                  <th
                    className="text-start font-semibold text-[11px] uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-foreground whitespace-nowrap"
                    onClick={() => toggleSort("action")}
                  >
                    {t("manager.colNextAction", "Next action")}
                    <SortArrow k="action" />
                  </th>
                  <th
                    className="text-start font-semibold text-[11px] uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-foreground whitespace-nowrap"
                    onClick={() => toggleSort("owner")}
                  >
                    {t("manager.colOwner", "Owner")}
                    <SortArrow k="owner" />
                  </th>
                  <th
                    className="text-start font-semibold text-[11px] uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-foreground whitespace-nowrap"
                    onClick={() => toggleSort("attn")}
                  >
                    {t("manager.colStatus", "Status")}
                    <SortArrow k="attn" />
                  </th>
                  <th
                    className="text-start font-semibold text-[11px] uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-foreground whitespace-nowrap"
                    onClick={() => toggleSort("time")}
                  >
                    {t("manager.colLastActivity", "Last activity")}
                    <SortArrow k="time" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const status = resolveStatus(c.status);
                  const meta = CASE_STATUS_LABELS[status];
                  const attn = attnFor(c);
                  const owner = assigneeName(c.assigned_to);
                  const sla = slaSummary(c.status, c.last_activity_at ?? c.created_at);
                  const rowBorder =
                    attn === "overdue"
                      ? "shadow-[inset_3px_0_0_0_hsl(var(--destructive))]"
                      : attn === "warn"
                        ? "shadow-[inset_3px_0_0_0_var(--color-orange-400,#fb923c)]"
                        : "";
                  return (
                    <tr
                      key={c.id}
                      onClick={() => openDrawer(c)}
                      className={`border-t border-border cursor-pointer hover:bg-muted/40 transition-colors ${rowBorder}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                            {initials(c.full_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{c.full_name}</div>
                            <div className="text-[11px] text-muted-foreground font-mono ltr" dir="ltr">
                              {c.phone_number}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <CaseStatusChip status={status} label={isAr ? meta.ar : meta.en} size="xs" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${toneClasses(toneForAttention(attn)).dot}`}
                          />
                          <span className="text-[13px]">{nextActionFor(c)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {owner ? (
                          <span className="flex items-center gap-1.5 text-muted-foreground text-[13px]">
                            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold">
                              {owner[0]}
                            </span>
                            {owner}
                          </span>
                        ) : (
                          <span className="text-destructive font-semibold text-[13px]">
                            {t("manager.unassigned", "Unassigned")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {attn === "overdue" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            {sla ?? t("manager.overdue", "Overdue")}
                          </span>
                        ) : attn === "warn" ? (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${toneClasses("payment").chip}`}>
                            {t("manager.needsAttention", "Needs attention")}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {t("manager.normal", "Normal")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-[13px] whitespace-nowrap">
                        {sla ?? `${daysSince(c.last_activity_at ?? c.created_at)}d`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail drawer — assign is the ONLY write action (Edit/Delete omitted). */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="space-y-0">
                <SheetTitle className="text-lg">{selected.full_name}</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  {assigneeName(selected.assigned_to)
                    ? t("manager.assignedTo", "Assigned to {{name}}", {
                        name: assigneeName(selected.assigned_to) ?? "",
                      })
                    : t("manager.unassigned", "Unassigned")}
                  {" · "}
                  <span className="font-mono ltr" dir="ltr">
                    {selected.phone_number}
                  </span>
                </p>
              </SheetHeader>

              {/* Progress rail */}
              <div className="px-6 mt-4">
                <div className="flex items-center gap-1">
                  {CASE_STATUS_ORDER.map((s, i) => {
                    const idx = statusIndex(selected.status);
                    const cls =
                      i < idx
                        ? "bg-primary"
                        : i === idx
                          ? "bg-primary"
                          : "bg-muted";
                    return <div key={s} className={`flex-1 h-1 rounded-full ${cls}`} />;
                  })}
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    {isAr ? CASE_STATUS_LABELS[CaseStatus.NEW].ar : CASE_STATUS_LABELS[CaseStatus.NEW].en}
                  </span>
                  <span className="text-[10px] text-primary font-bold">
                    {isAr
                      ? CASE_STATUS_LABELS[resolveStatus(selected.status)].ar
                      : CASE_STATUS_LABELS[resolveStatus(selected.status)].en}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {isAr ? CASE_STATUS_LABELS[CaseStatus.ENROLLMENT_PAID].ar : CASE_STATUS_LABELS[CaseStatus.ENROLLMENT_PAID].en}
                  </span>
                </div>
              </div>

              <div className="px-6 mt-6 space-y-6">
                {/* Attention panel */}
                <div>
                  <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-2">
                    {t("manager.needsAttentionTitle", "Needs attention")}
                  </h3>
                  <div className="rounded-lg border border-border bg-muted/30 p-1">
                    {attnFor(selected) !== "normal" ? (
                      <div className="flex items-center justify-between px-3 py-2.5 text-sm">
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              attnFor(selected) === "overdue" ? "bg-destructive" : "bg-orange-400"
                            }`}
                          />
                          {attnFor(selected) === "overdue"
                            ? t("manager.overdueTask", "SLA breached — action required")
                            : t("manager.warnTask", "Approaching SLA threshold")}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-3 text-sm text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        {t("manager.noTasks", "No pending tasks — on track.")}
                      </div>
                    )}
                  </div>
                </div>

                {/* Overview */}
                <div>
                  <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-2">
                    {t("manager.overviewTitle", "Overview")}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] text-muted-foreground mb-0.5">{t("manager.colStage", "Stage")}</div>
                      <div className="text-sm font-medium">
                        {isAr ? CASE_STATUS_LABELS[resolveStatus(selected.status)].ar : CASE_STATUS_LABELS[resolveStatus(selected.status)].en}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground mb-0.5">
                        {t("manager.colLastActivity", "Last activity")}
                      </div>
                      <div className="text-sm font-medium">
                        {slaSummary(selected.status, selected.last_activity_at ?? selected.created_at) ??
                          `${daysSince(selected.last_activity_at ?? selected.created_at)}d`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground mb-0.5">{t("manager.colOwner", "Owner")}</div>
                      <div className="text-sm font-medium">
                        {assigneeName(selected.assigned_to) ?? t("manager.unassigned", "Unassigned")}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground mb-0.5">{t("manager.colPhone", "Phone")}</div>
                      <div className="text-sm font-medium font-mono ltr" dir="ltr">
                        {selected.phone_number}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary action: assign */}
                <div>
                  <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-2">
                    {t("admin.pipeline.assignToTeam", "Assign to Team Member")}
                  </h3>
                  <Select
                    value={selected.assigned_to || "unassigned"}
                    onValueChange={(val) => assignCase(selected.id, val === "unassigned" ? null : val)}
                    disabled={assigning === selected.id}
                  >
                    <SelectTrigger className="w-full">
                      <UserCheck className="h-4 w-4 me-2" />
                      <SelectValue placeholder={t("admin.pipeline.assignPlaceholder", "Assign to team member")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">{t("admin.pipeline.unassigned", "Unassigned")}</SelectItem>
                      {teamMembers.map((tm) => (
                        <SelectItem key={tm.id} value={tm.id}>
                          {tm.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("manager.assignHint", "Assigning moves the case into a team member's queue. Other fields stay admin-only.")}
                  </p>
                </div>

                {/* Secondary actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const phone = selected.phone_number.replace(/\D/g, "");
                      window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <MessageCircle className="h-4 w-4 me-1" />
                    {t("manager.whatsapp", "WhatsApp")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => (window.location.href = `tel:${selected.phone_number}`)}
                  >
                    <Phone className="h-4 w-4 me-1" />
                    {t("manager.call", "Call")}
                  </Button>
                </div>

                <button
                  onClick={() => {
                    const id = selected.id;
                    setSheetOpen(false);
                    navigate(`/team/cases/${id}`);
                  }}
                  className="w-full text-center text-sm text-muted-foreground py-2.5 border border-dashed border-border rounded-lg hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("admin.pipeline.viewFullFile", "View Full File")}
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TeamPipelinePage;
