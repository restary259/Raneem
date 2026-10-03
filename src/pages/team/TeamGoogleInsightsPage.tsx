import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useOfficeWorkspaceSelection } from "@/lib/officeWorkspace";
import type { TFunction } from "i18next";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarRange,
  Clock3,
  Download,
  Info,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PerformanceTrendChart, {
  type PerformanceSeriesConfig,
} from "@/components/google/PerformanceTrendChart";
import { useToast } from "@/hooks/use-toast";
import { downloadCsv } from "@/utils/csv";
import {
  addDaysIso,
  expectedDataThrough,
  formatCount,
  formatInsightsValue,
  formatMonth,
  groupSeriesByDate,
  METRIC_LABEL_KEYS,
  googlePerformanceHealth,
  officeToday,
  percentChange,
  previousMonths,
  previousPeriod,
  resolveDateRange,
  type InsightsPreset,
} from "@/lib/googlePerformance";
import {
  buildPerformanceExportRows,
  performanceExportFileName,
} from "@/lib/googlePerformanceExport";
import {
  backfillGooglePerformance,
  getGooglePerformanceAggregate,
  getGooglePerformanceContext,
  getGooglePerformanceExport,
  getGooglePerformanceSeries,
  getGooglePerformanceSummary,
  getGooglePerformanceSyncJobs,
  getGoogleSearchKeywords,
  listGooglePerformanceOffices,
  recordGooglePerformanceAudit,
  syncGooglePerformance,
} from "@/lib/googleBusinessPerformance.functions";
import type {
  GooglePerformanceAggregateRow,
  GooglePerformanceContext,
  GooglePerformanceMetric,
  GooglePerformanceOfficeRow,
  GooglePerformanceSeriesPoint,
  GooglePerformanceSummary,
  GooglePerformanceSyncJob,
  GoogleSearchKeywordRow,
} from "@/types/googleBusiness";

const KEYWORD_PAGE_SIZE = 25;
/** Months of keyword history shown; matches the sync's keyword backfill. */
const KEYWORD_MONTHS = 6;

const CHART_COLORS = {
  search: "#2563eb",
  maps: "#0ea5e9",
  website: "#16a34a",
  calls: "#f59e0b",
  directions: "#8b5cf6",
  conversations: "#ec4899",
};

/** Presets whose date range must be resolved against the office timezone. */
type ResolvedPreset = Exclude<InsightsPreset, "custom">;

function localeTag(language: string): string {
  if (language.startsWith("ar")) return "ar";
  if (language.startsWith("he")) return "he";
  return "en";
}

function useIsRtl(): boolean {
  const { i18n } = useTranslation("dashboard");
  return i18n.language === "ar" || i18n.language === "he";
}

function errorMessage(error: unknown): string | undefined {
  return (error as { message?: string } | null)?.message;
}

/**
 * The Google Business Insights page (Phase 8).
 *
 * Office-first: an operator sees only the offices they operate, an admin may
 * switch to "All offices" and gets a clearly-labelled DARB aggregate plus a
 * per-office comparison. Nothing here recomputes Google's numbers — the page
 * reads DARB's cached copy and shows Google's own metrics by name.
 */
export default function TeamGoogleInsightsPage() {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const isRtl = useIsRtl();
  const locale = localeTag(i18n.language);

  const runListOffices = useServerFn(listGooglePerformanceOffices);
  const runContext = useServerFn(getGooglePerformanceContext);
  const runSummary = useServerFn(getGooglePerformanceSummary);
  const runSeries = useServerFn(getGooglePerformanceSeries);
  const runKeywords = useServerFn(getGoogleSearchKeywords);
  const runJobs = useServerFn(getGooglePerformanceSyncJobs);
  const runAggregate = useServerFn(getGooglePerformanceAggregate);
  const runSync = useServerFn(syncGooglePerformance);
  const runBackfill = useServerFn(backfillGooglePerformance);
  const runExport = useServerFn(getGooglePerformanceExport);
  const runAudit = useServerFn(recordGooglePerformanceAudit);

  // Office context from the canonical office route (or legacy ?office=slug).
  const { officeId: workspaceOfficeId } = useOfficeWorkspaceSelection();

  const [offices, setOffices] = useState<GooglePerformanceOfficeRow[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(true);
  const [selected, setSelected] = useState<string>("");
  const [preset, setPreset] = useState<InsightsPreset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [range, setRange] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);

  const [context, setContext] = useState<GooglePerformanceContext | null>(null);
  const [summary, setSummary] = useState<GooglePerformanceSummary | null>(null);
  const [series, setSeries] = useState<GooglePerformanceSeriesPoint[]>([]);
  const [keywords, setKeywords] = useState<GoogleSearchKeywordRow[]>([]);
  const [keywordTotal, setKeywordTotal] = useState(0);
  const [keywordOffset, setKeywordOffset] = useState(0);
  const [keywordSearchInput, setKeywordSearchInput] = useState("");
  const [keywordSearch, setKeywordSearch] = useState("");
  const [jobs, setJobs] = useState<GooglePerformanceSyncJob[]>([]);
  const [keywordError, setKeywordError] = useState<string | null>(null);
  const [aggregate, setAggregate] = useState<GooglePerformanceAggregateRow[]>(
    [],
  );

  const [loadingData, setLoadingData] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isAll = selected === "ALL";
  const isAdminView = offices.some((o) => o.operator_role === "ADMIN");
  const selectedOffice = offices.find((o) => o.office_id === selected) ?? null;

  // -------------------------------------------------------------------------
  // Load the office selector once.
  // -------------------------------------------------------------------------
  const loadOffices = useCallback(async () => {
    setLoadingOffices(true);
    try {
      const rows = await runListOffices({ data: {} });
      setOffices(rows);
      const admin = rows.some((o) => o.operator_role === "ADMIN");
      const inList =
        workspaceOfficeId &&
        rows.some((o) => o.office_id === workspaceOfficeId);
      setSelected(
        (current) =>
          current ||
          (inList
            ? (workspaceOfficeId as string)
            : admin
              ? "ALL"
              : (rows[0]?.office_id ?? "")),
      );
    } catch (error) {
      toast({
        variant: "destructive",
        description: errorMessage(error) || t("googleInsights.loadError"),
      });
    } finally {
      setLoadingOffices(false);
    }
  }, [runListOffices, t, toast, workspaceOfficeId]);

  useEffect(() => {
    loadOffices();
  }, [loadOffices]);

  // Follow the URL's office when it changes (e.g. navigating between offices).
  useEffect(() => {
    if (
      workspaceOfficeId &&
      offices.some((o) => o.office_id === workspaceOfficeId)
    ) {
      setSelected(workspaceOfficeId);
    }
  }, [workspaceOfficeId, offices]);

  // Debounce the keyword search so we never query on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setKeywordSearch(keywordSearchInput), 350);
    return () => clearTimeout(id);
  }, [keywordSearchInput]);

  // -------------------------------------------------------------------------
  // Resolve the selected period against the OFFICE timezone.
  // -------------------------------------------------------------------------
  const timezone = useMemo(() => {
    if (isAll) return offices[0]?.timezone || "Europe/Berlin";
    return selectedOffice?.timezone || "Europe/Berlin";
  }, [isAll, offices, selectedOffice]);

  useEffect(() => {
    if (preset === "custom") return;
    setRange(resolveDateRange(preset as ResolvedPreset, timezone));
  }, [preset, timezone]);

  // -------------------------------------------------------------------------
  // Load the data for the selected office + range.
  // -------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    if (!selected || !range) return;
    setLoadingData(true);
    setLoadError(null);
    try {
      if (isAll) {
        const prev = previousPeriod(range);
        const rows = await runAggregate({
          data: {
            startDate: range.startDate,
            endDate: range.endDate,
            previousStartDate: prev.startDate,
            previousEndDate: prev.endDate,
          },
        });
        setAggregate(rows);
        setSummary(null);
        setSeries([]);
        setKeywords([]);
        setJobs([]);
        return;
      }

      const prev = previousPeriod(range);
      const [ctx, sum, ser, jobRows] = await Promise.all([
        runContext({ data: { officeId: selected } }),
        runSummary({
          data: {
            officeId: selected,
            startDate: range.startDate,
            endDate: range.endDate,
            previousStartDate: prev.startDate,
            previousEndDate: prev.endDate,
          },
        }),
        runSeries({
          data: {
            officeId: selected,
            startDate: range.startDate,
            endDate: range.endDate,
          },
        }),
        runJobs({ data: { officeId: selected, limit: 8 } }),
      ]);
      setContext(ctx);
      setSummary(sum);
      setSeries(ser);
      setJobs(jobRows);

      // Audit a meaningful view, not every render.
      runAudit({
        data: {
          officeId: selected,
          action: "GOOGLE_PERFORMANCE_VIEWED",
          detail: { start: range.startDate, end: range.endDate },
        },
      }).catch(() => {});
    } catch (error) {
      setLoadError(errorMessage(error) || t("googleInsights.loadError"));
    } finally {
      setLoadingData(false);
    }
  }, [
    isAll,
    range,
    runAggregate,
    runAudit,
    runContext,
    runJobs,
    runSeries,
    runSummary,
    selected,
    t,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keyword data is loaded separately from the metrics so a keyword search or a
  // "load more" only re-reads the cached keyword table, not the whole page.
  const loadKeywords = useCallback(
    async (offset: number, search: string, append: boolean) => {
      if (!selected || isAll || !range) return;
      // Keywords are monthly and their own data domain, so their window is a
      // month range, not the metrics preset: a 7-day metrics view still shows
      // the recent months of search discovery.
      const months = previousMonths(
        range.endDate.slice(0, 7) + "-01",
        KEYWORD_MONTHS - 1,
      );
      const startMonth = months[months.length - 1];
      const rows = await runKeywords({
        data: {
          officeId: selected,
          startMonth,
          endMonth: range.endDate.slice(0, 7) + "-01",
          search: search || undefined,
          limit: KEYWORD_PAGE_SIZE,
          offset,
          sort: "impressions_desc",
        },
      });
      setKeywords((prev) => (append ? [...prev, ...rows] : rows));
      setKeywordError(null);
      // Keep the last known total when an append page comes back empty rather
      // than hiding "Load more" by zeroing the count.
      if (rows.length > 0 || !append) {
        setKeywordTotal(rows[0]?.total_count ?? 0);
      }
      setKeywordOffset(offset);
    },
    [isAll, range, runKeywords, selected],
  );

  useEffect(() => {
    if (!selected || isAll || !range) return;
    loadKeywords(0, keywordSearch, false).catch((error) => {
      // A failed read is not an empty dataset: surface it distinctly instead of
      // rendering "no data" (AGENTS.md: never launder query errors into []).
      setKeywordError(errorMessage(error) || t("googleInsights.loadError"));
      setKeywords([]);
      setKeywordTotal(0);
    });
  }, [isAll, keywordSearch, loadKeywords, range, selected, t]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleSync = useCallback(async () => {
    if (!selected || isAll) return;
    setSyncing(true);
    try {
      const result = await runSync({ data: { officeId: selected } });
      if (result.status === "synced") {
        toast({
          description: t("googleInsights.syncedNow", {
            metrics: result.metrics?.inserted ?? 0,
            keywords: result.keywords?.inserted ?? 0,
          }),
        });
      } else if (result.status === "partial") {
        // "partial" means the keyword phase lagged, so do not claim metrics
        // synced when a later reordering could make this fire on a metrics miss.
        toast({ description: t("googleInsights.keywordsLagging") });
      } else if (result.status === "locked") {
        toast({
          variant: "destructive",
          description: t("googleInsights.syncLocked"),
        });
      } else {
        toast({
          variant: "destructive",
          description: t(
            `googleInsights.error.${result.errorCode ?? "GOOGLE_PERFORMANCE_NOT_AVAILABLE"}`,
            {
              defaultValue: t("googleInsights.syncFailed"),
            },
          ),
        });
      }
      await loadData();
      await loadOffices();
    } catch (error) {
      toast({
        variant: "destructive",
        description: errorMessage(error) || t("googleInsights.syncFailed"),
      });
    } finally {
      setSyncing(false);
    }
  }, [isAll, loadData, loadOffices, runSync, selected, t, toast]);

  const handleBackfill = useCallback(async () => {
    if (!selected || isAll) return;
    setSyncing(true);
    try {
      const endDate = officeToday(timezone);
      const result = await runBackfill({
        data: {
          officeId: selected,
          startDate: addDaysIso(endDate, -364),
          endDate,
        },
      });
      if (result.ok) {
        toast({ description: t("googleInsights.backfillDone") });
      } else {
        toast({
          variant: "destructive",
          description: t("googleInsights.syncFailed"),
        });
      }
      await loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        description: errorMessage(error) || t("googleInsights.syncFailed"),
      });
    } finally {
      setSyncing(false);
    }
  }, [isAll, loadData, runBackfill, selected, t, timezone, toast]);

  const handleLoadMoreKeywords = useCallback(async () => {
    if (!selected || isAll) return;
    await loadKeywords(keywordOffset + KEYWORD_PAGE_SIZE, keywordSearch, true);
  }, [isAll, keywordOffset, keywordSearch, loadKeywords, selected]);

  const handleExport = useCallback(async () => {
    if (!selected || isAll || !range) return;
    setExporting(true);
    try {
      const data = await runExport({
        data: {
          officeId: selected,
          startDate: range.startDate,
          endDate: range.endDate,
        },
      });
      const rows = buildPerformanceExportRows(data.series, data.keywords, {
        officeName: data.officeName,
        googleLocationName: data.googleLocationName,
        metricLabel: (metric) =>
          t(`googleInsights.${METRIC_LABEL_KEYS[metric]}`),
      });
      const ok = downloadCsv(
        rows,
        performanceExportFileName(
          data.officeName,
          range.startDate,
          range.endDate,
        ),
      );
      if (!ok) {
        toast({ description: t("googleInsights.exportEmpty") });
        return;
      }
      await runAudit({
        data: {
          officeId: selected,
          action: "GOOGLE_PERFORMANCE_EXPORTED",
          detail: {
            start: range.startDate,
            end: range.endDate,
            rows: data.series.length + data.keywords.length,
          },
        },
      }).catch(() => {});
      toast({ description: t("googleInsights.exportDone") });
    } catch (error) {
      toast({
        variant: "destructive",
        description: errorMessage(error) || t("googleInsights.exportFailed"),
      });
    } finally {
      setExporting(false);
    }
  }, [isAll, range, runAudit, runExport, selected, t, toast]);

  // -------------------------------------------------------------------------
  // Derived display data
  // -------------------------------------------------------------------------
  const summaryCards = useMemo(() => {
    if (!summary) return [];
    const defs: { metric: GooglePerformanceMetric; accent: string }[] = [
      {
        metric: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
        accent: CHART_COLORS.search,
      },
      { metric: "BUSINESS_IMPRESSIONS_MOBILE_MAPS", accent: CHART_COLORS.maps },
      { metric: "WEBSITE_CLICKS", accent: CHART_COLORS.website },
      { metric: "CALL_CLICKS", accent: CHART_COLORS.calls },
      {
        metric: "BUSINESS_DIRECTION_REQUESTS",
        accent: CHART_COLORS.directions,
      },
    ];
    return defs
      .filter((d) => summary.metric_status[d.metric] !== "NOT_AVAILABLE")
      .map((d) => {
        const current = summary.current_totals[d.metric] ?? 0;
        const previous = summary.previous_totals[d.metric] ?? 0;
        return {
          metric: d.metric,
          label: t(`googleInsights.${METRIC_LABEL_KEYS[d.metric]}`),
          value: current,
          change: percentChange(current, previous),
          accent: d.accent,
        };
      });
  }, [summary, t]);

  const aggregateCards = useMemo(() => {
    if (!isAll) return [];
    const defs: GooglePerformanceMetric[] = [
      "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
      "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
      "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
      "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
      "WEBSITE_CLICKS",
      "CALL_CLICKS",
      "BUSINESS_DIRECTION_REQUESTS",
      "BUSINESS_CONVERSATIONS",
    ];
    return defs.map((metric) => {
      const total = aggregate.reduce((acc, row) => {
        if (row.metric_status[metric] === "NOT_AVAILABLE") return acc;
        return acc + (row.current_totals[metric] ?? 0);
      }, 0);
      const measured = aggregate.some(
        (row) => row.metric_status[metric] !== "NOT_AVAILABLE",
      );
      return { metric, total, measured };
    });
  }, [aggregate, isAll]);

  const visibilityRows = useMemo(() => groupSeriesByDate(series), [series]);
  const actionsRows = useMemo(() => groupSeriesByDate(series), [series]);

  const visibilitySeries: PerformanceSeriesConfig[] = [
    {
      metric: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
      label: t("googleInsights.searchImpressions"),
      color: CHART_COLORS.search,
    },
    {
      metric: "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
      label: t("googleInsights.mapsImpressions"),
      color: CHART_COLORS.maps,
    },
  ];
  const actionSeries: PerformanceSeriesConfig[] = [
    {
      metric: "WEBSITE_CLICKS",
      label: t("googleInsights.websiteClicks"),
      color: CHART_COLORS.website,
    },
    {
      metric: "CALL_CLICKS",
      label: t("googleInsights.callClicks"),
      color: CHART_COLORS.calls,
    },
    {
      metric: "BUSINESS_DIRECTION_REQUESTS",
      label: t("googleInsights.directionRequests"),
      color: CHART_COLORS.directions,
    },
  ];

  const health = useMemo(
    () =>
      isAll
        ? null
        : googlePerformanceHealth(
            context,
            context ? expectedDataThrough(context.timezone) : "",
          ),
    [context, isAll],
  );

  const newestJob = jobs[0] ?? null;

  // A keyword sync that lagged behind a healthy metrics sync is derived from the
  // latest keyword job rather than transient client state, so it survives the
  // reload that follows a sync and clears itself once keywords succeed again.
  const keywordSyncLagging =
    !isAll &&
    (jobs.find((j) => j.sync_type === "KEYWORDS")?.status ?? null) === "FAILED";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loadingOffices) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pt-4 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (offices.length === 0) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-2 py-10 text-center">
            <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {t("googleInsights.noOfficeTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("googleInsights.noOfficeDesc")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-6xl space-y-5 px-4 pt-4 pb-10 sm:px-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BarChart3 className="size-5 shrink-0 text-primary" />
          <h1 className="truncate text-2xl font-semibold">
            {t("googleInsights.title")}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdminView && offices.length > 1 ? (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger
                className="h-9 w-44"
                aria-label={t("googleInsights.office")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {t("googleInsights.allOffices")}
                </SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o.office_id} value={o.office_id}>
                    {o.office_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Select
            value={preset}
            onValueChange={(v) => setPreset(v as InsightsPreset)}
          >
            <SelectTrigger
              className="h-9 w-36"
              aria-label={t("googleInsights.dateRange")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t("googleInsights.range7d")}</SelectItem>
              <SelectItem value="30d">
                {t("googleInsights.range30d")}
              </SelectItem>
              <SelectItem value="90d">
                {t("googleInsights.range90d")}
              </SelectItem>
              <SelectItem value="12m">
                {t("googleInsights.range12m")}
              </SelectItem>
              <SelectItem value="custom">
                {t("googleInsights.rangeCustom")}
              </SelectItem>
            </SelectContent>
          </Select>

          {!isAll ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw
                className={`size-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? t("googleInsights.syncing") : t("googleInsights.sync")}
            </Button>
          ) : null}
          {!isAll ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download className="size-4" />
              {t("googleInsights.export")}
            </Button>
          ) : null}
        </div>
      </header>

      {preset === "custom" ? (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="flex flex-wrap items-end gap-3 py-4">
            <div className="space-y-1">
              <label
                className="text-xs text-muted-foreground"
                htmlFor="insights-from"
              >
                {t("googleInsights.from")}
              </label>
              <Input
                id="insights-from"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 w-40"
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-xs text-muted-foreground"
                htmlFor="insights-to"
              >
                {t("googleInsights.to")}
              </label>
              <Input
                id="insights-to"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 w-40"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (!customStart || !customEnd) return;
                if (customStart > customEnd) {
                  toast({
                    variant: "destructive",
                    description: t("googleInsights.customInvalid"),
                  });
                  return;
                }
                setRange({ startDate: customStart, endDate: customEnd });
              }}
            >
              {t("googleInsights.apply")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loadError ? (
        <Card className="rounded-2xl border-destructive/40 shadow-sm">
          <CardContent className="flex items-start gap-2 py-5 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>{loadError}</span>
          </CardContent>
        </Card>
      ) : null}

      {!isAll && keywordSyncLagging ? (
        <Card className="rounded-2xl border-amber-500/40 shadow-sm">
          <CardContent className="flex items-start gap-2 py-4 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>{t("googleInsights.partialNotice")}</span>
          </CardContent>
        </Card>
      ) : null}

      {isAll ? (
        <>
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4 text-primary" />
                {t("googleInsights.allOffices")}
                <Badge variant="secondary">
                  {t("googleInsights.darbAggregate")}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("googleInsights.darbAggregateNote")}
              </p>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {aggregateCards
                    .filter((c) => c.measured)
                    .map((c) => (
                      <MetricStat
                        key={c.metric}
                        label={t(
                          `googleInsights.${METRIC_LABEL_KEYS[c.metric]}`,
                        )}
                        value={c.total}
                        locale={locale}
                      />
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t("googleInsights.officeComparison")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("googleInsights.websiteClicks")}
              </p>
              {aggregate
                .slice()
                .sort(
                  (a, b) =>
                    (b.current_totals.WEBSITE_CLICKS ?? 0) -
                    (a.current_totals.WEBSITE_CLICKS ?? 0),
                )
                .map((row) => (
                  <div
                    key={row.office_id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate">{row.office_name}</span>
                    <span className="font-medium tabular-nums">
                      {formatCount(
                        row.current_totals.WEBSITE_CLICKS ?? 0,
                        locale,
                      )}
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {context && !context.has_any_data && !loadingData ? (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardContent className="space-y-2 py-8 text-center">
                <Clock3 className="mx-auto size-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {t("googleInsights.notEnoughHistory")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("googleInsights.notEnoughHistoryDesc")}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBackfill}
                  disabled={syncing}
                >
                  {t("googleInsights.syncHistorical")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {loadingData
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                    ))
                  : summaryCards.map((card) => (
                      <SummaryCard
                        key={card.metric}
                        label={card.label}
                        value={card.value}
                        change={card.change}
                        accent={card.accent}
                        locale={locale}
                        t={t}
                      />
                    ))}
              </div>

              <Card className="rounded-2xl border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {t("googleInsights.visibility")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PerformanceTrendChart
                    rows={visibilityRows}
                    series={visibilitySeries}
                    locale={locale}
                    isRtl={isRtl}
                    ariaLabel={buildAriaSummary(
                      t,
                      visibilitySeries,
                      summary,
                      "searchImpressions",
                    )}
                    emptyLabel={t("googleInsights.noData")}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {t("googleInsights.customerActions")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PerformanceTrendChart
                    rows={actionsRows}
                    series={actionSeries}
                    locale={locale}
                    isRtl={isRtl}
                    ariaLabel={buildAriaSummary(
                      t,
                      actionSeries,
                      summary,
                      "websiteClicks",
                    )}
                    emptyLabel={t("googleInsights.noData")}
                  />
                  <div className="mt-4 space-y-1.5">
                    {actionSeries.map((s) => (
                      <div
                        key={s.metric}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.label}
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatCount(
                            summary?.current_totals[s.metric] ?? 0,
                            locale,
                          )}
                        </span>
                      </div>
                    ))}
                    {summary &&
                    summary.metric_status.BUSINESS_CONVERSATIONS !==
                      "NOT_AVAILABLE" ? (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span>{t("googleInsights.conversations")}</span>
                        <span className="font-medium tabular-nums">
                          {formatCount(
                            summary.current_totals.BUSINESS_CONVERSATIONS ?? 0,
                            locale,
                          )}
                        </span>
                      </div>
                    ) : null}
                    {summary &&
                    summary.metric_status.BUSINESS_BOOKINGS !==
                      "NOT_AVAILABLE" ? (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span>{t("googleInsights.bookings")}</span>
                        <span className="font-medium tabular-nums">
                          {formatCount(
                            summary.current_totals.BUSINESS_BOOKINGS ?? 0,
                            locale,
                          )}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                        <span>{t("googleInsights.bookings")}</span>
                        <span>{t("googleInsights.notAvailable")}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {t("googleInsights.searchDiscovery")}
                    </CardTitle>
                    <div className="relative">
                      <Search className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={keywordSearchInput}
                        onChange={(e) => setKeywordSearchInput(e.target.value)}
                        placeholder={t("googleInsights.searchPlaceholder")}
                        className="h-9 w-56 ps-8"
                        aria-label={t("googleInsights.searchPlaceholder")}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("googleInsights.searchDiscoveryNote")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {keywordError ? (
                    <p className="py-6 text-center text-sm text-destructive">
                      {keywordError}
                    </p>
                  ) : keywords.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      {t("googleInsights.noData")}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            {t("googleInsights.searchKeyword")}
                          </TableHead>
                          <TableHead>{t("googleInsights.month")}</TableHead>
                          <TableHead className="text-end">
                            {t("googleInsights.impressions")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keywords.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="truncate">
                              {row.search_keyword}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {formatMonth(row.month, locale)}
                            </TableCell>
                            <TableCell className="text-end tabular-nums">
                              {row.insights_value_type === "THRESHOLD" ? (
                                <span title={t("googleInsights.thresholdNote")}>
                                  {formatInsightsValue(
                                    row.insights_value,
                                    row.insights_value_type,
                                    locale,
                                  )}
                                </span>
                              ) : (
                                formatInsightsValue(
                                  row.insights_value,
                                  row.insights_value_type,
                                  locale,
                                )
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {keywords.length < keywordTotal ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleLoadMoreKeywords}
                    >
                      {t("googleInsights.loadMore")}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {t("googleInsights.dataStatus")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block size-2 rounded-full ${
                        health === "Healthy"
                          ? "bg-emerald-500"
                          : health === "Stale"
                            ? "bg-amber-500"
                            : "bg-muted-foreground"
                      }`}
                    />
                    <span>
                      {health === "Healthy"
                        ? t("googleInsights.healthy")
                        : health === "Stale"
                          ? t("googleInsights.stale")
                          : health === "Syncing"
                            ? t("googleInsights.preparing")
                            : t("googleInsights.unavailable")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarRange className="size-4" />
                    <span>
                      {t("googleInsights.dataThrough")}:{" "}
                      {context?.data_through ??
                        t("googleInsights.notAvailable")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock3 className="size-4" />
                    <span>
                      {t("googleInsights.lastSynced", {
                        time: context?.performance_last_synced_at
                          ? new Date(
                              context.performance_last_synced_at,
                            ).toLocaleTimeString(locale, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : t("googleInsights.notAvailable"),
                      })}
                    </span>
                  </div>
                  {newestJob ? (
                    <div className="pt-1 text-xs text-muted-foreground">
                      {t("googleInsights.syncJobSummary", {
                        type: t(
                          `googleInsights.syncType.${newestJob.sync_type}`,
                        ),
                        status: t(
                          `googleInsights.syncStatus.${newestJob.status}`,
                        ),
                        records: newestJob.records_processed,
                      })}
                    </div>
                  ) : null}
                  <p className="pt-1 text-xs text-muted-foreground">
                    {t("googleInsights.sourceGoogle")}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  change,
  accent,
  locale,
  t,
}: {
  label: string;
  value: number;
  change: number | null;
  accent: string;
  locale: string;
  t: TFunction<"dashboard">;
}) {
  const up = change !== null && change >= 0;
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardContent className="space-y-1 py-4">
        <span
          className="inline-block h-1 w-8 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatCount(value, locale)}
        </p>
        {change === null ? (
          <p className="text-xs text-muted-foreground">
            {t("googleInsights.noPreviousBaseline")}
          </p>
        ) : (
          <p
            className={`flex items-center gap-1 text-xs ${
              up ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {up ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(change).toFixed(1)}% {t("googleInsights.previousPeriod")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricStat({
  label,
  value,
  locale,
}: {
  label: string;
  value: number;
  locale: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">
        {formatCount(value, locale)}
      </p>
    </div>
  );
}

/** Screen readers cannot read a line chart; this is the same story in words. */
function buildAriaSummary(
  t: TFunction<"dashboard">,
  series: PerformanceSeriesConfig[],
  summary: GooglePerformanceSummary | null,
  primaryKey: string,
): string {
  if (!summary || series.length === 0) return t("googleInsights.noData");
  const primary = series[0];
  const current = summary.current_totals[primary.metric] ?? 0;
  const previous = summary.previous_totals[primary.metric] ?? 0;
  const change = percentChange(current, previous);
  if (change === null) {
    return t("googleInsights.ariaSummary", {
      label: primary.label,
      current: formatCount(current, "en"),
      change: t("googleInsights.noPreviousBaseline"),
      key: primaryKey,
    });
  }
  const direction =
    change >= 0 ? t("googleInsights.ariaUp") : t("googleInsights.ariaDown");
  return t("googleInsights.ariaSummaryChange", {
    label: primary.label,
    previous: formatCount(previous, "en"),
    current: formatCount(current, "en"),
    direction,
    percent: Math.abs(change).toFixed(1),
  });
}
