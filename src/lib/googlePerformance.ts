import type {
  GooglePerformanceMetric,
  GooglePerformanceSeriesPoint,
} from "@/types/googleBusiness";

/**
 * Phase 8 pure helpers for the Insights page.
 *
 * Two rules shape everything here:
 *   1. Presets resolve against the OFFICE timezone, not the browser's, so a
 *      "last 30 days" window means the same thing in Berlin as it does in Tel
 *      Aviv and never shifts by a day for an admin abroad.
 *   2. Missing days stay missing. The chart groups only the rows Google actually
 *      returned; a date with no row becomes a gap, a date with a ZERO row becomes
 *      a real 0.
 */

export type InsightsPreset = "7d" | "30d" | "90d" | "12m" | "custom";

export const INSIGHTS_PRESETS: InsightsPreset[] = [
  "7d",
  "30d",
  "90d",
  "12m",
  "custom",
];

export type DateRange = { startDate: string; endDate: string };

/** Calendar parts for an instant in a specific timezone. */
export function officeDateParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Today's date in the office timezone. */
export function officeToday(timeZone: string, now: Date = new Date()): string {
  const { year, month, day } = officeDateParts(now, timeZone);
  return toIso(year, month, day);
}

/** Shift an ISO date by whole days. Pure calendar arithmetic (no TZ drift). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Whole days between two ISO dates (inclusive-aware length = diff + 1). */
export function daysBetweenInclusive(startIso: string, endIso: string): number {
  const [y1, m1, d1] = startIso.split("-").map(Number);
  const [y2, m2, d2] = endIso.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * Resolves a preset to a concrete range in the office timezone.
 * `12m` is 365 days so it spans a full year including the current partial month.
 */
export function resolveDateRange(
  preset: Exclude<InsightsPreset, "custom">,
  timeZone: string,
  now: Date = new Date(),
): DateRange {
  const end = officeToday(timeZone, now);
  const span =
    preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 365;
  return { startDate: addDaysIso(end, -(span - 1)), endDate: end };
}

/**
 * The comparison window immediately before the current one, same length. DARB
 * computes this itself; Google publishes no such comparison.
 */
export function previousPeriod(range: DateRange): DateRange {
  const length = daysBetweenInclusive(range.startDate, range.endDate);
  const prevEnd = addDaysIso(range.startDate, -1);
  return { startDate: addDaysIso(prevEnd, -(length - 1)), endDate: prevEnd };
}

/** First day of the month for an ISO date. */
export function firstOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Month range for keyword data: the last `months` calendar months, inclusive. */
export function resolveMonthRange(
  months: number,
  timeZone: string,
  now: Date = new Date(),
): { startMonth: string; endMonth: string } {
  const endMonth = firstOfMonth(officeToday(timeZone, now));
  const [y, m] = endMonth.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1 - (months - 1), 1));
  return {
    startMonth: toIso(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
    endMonth,
  };
}

/** The last date Google could plausibly have reported, used for the Stale check. */
export function expectedDataThrough(
  timeZone: string,
  now: Date = new Date(),
): string {
  // Google performance data can lag by a day or two, so "stale" is measured
  // against yesterday rather than today.
  return addDaysIso(officeToday(timeZone, now), -1);
}

/** Metric -> i18n key under the `dashboard:googleInsights` namespace. */
export const METRIC_LABEL_KEYS: Record<GooglePerformanceMetric, string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "mapsImpressionsDesktop",
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "searchImpressionsDesktop",
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: "mapsImpressionsMobile",
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "searchImpressionsMobile",
  BUSINESS_CONVERSATIONS: "conversations",
  BUSINESS_DIRECTION_REQUESTS: "directionRequests",
  CALL_CLICKS: "callClicks",
  WEBSITE_CLICKS: "websiteClicks",
  BUSINESS_BOOKINGS: "bookings",
  BUSINESS_FOOD_MENU_CLICKS: "menuClicks",
};

/** A merged, date-keyed row for recharts. Missing days are absent keys, so the
 *  chart draws a gap rather than an invented 0. */
export type PerformanceChartRow = { date: string } & Partial<
  Record<GooglePerformanceMetric, number>
>;

export function groupSeriesByDate(
  points: GooglePerformanceSeriesPoint[],
): PerformanceChartRow[] {
  const byDate = new Map<string, PerformanceChartRow>();
  for (const point of points) {
    const row = byDate.get(point.metric_date) ?? { date: point.metric_date };
    row[point.metric] = (row[point.metric] ?? 0) + point.metric_value;
    byDate.set(point.metric_date, row);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Sums a set of metrics over a period from a chart-ready series. */
export function sumSeries(
  points: GooglePerformanceSeriesPoint[],
  metrics: readonly GooglePerformanceMetric[],
): number {
  const wanted = new Set<string>(metrics);
  let total = 0;
  for (const point of points) {
    if (wanted.has(point.metric)) total += point.metric_value;
  }
  return total;
}

/** Compact number for the executive snapshot (12,481 -> 12.5k), locale-aware. */
export function formatCompact(value: number, locale: string): string {
  if (!Number.isFinite(value)) return "—";
  const tag =
    locale === "ar" ? "ar-u-nu-latn" : locale === "he" ? "he" : "en-US";
  return new Intl.NumberFormat(tag, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Full number with grouping, Latin digits in every locale. */
export function formatCount(value: number, locale: string): string {
  if (!Number.isFinite(value)) return "—";
  const tag =
    locale === "ar" ? "ar-u-nu-latn" : locale === "he" ? "he" : "en-US";
  return new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(value);
}

/** A keyword value: an exact number, or "<N" when Google returned a threshold. */
export function formatInsightsValue(
  value: number,
  type: "VALUE" | "THRESHOLD",
  locale: string,
): string {
  const formatted = formatCount(value, locale);
  return type === "THRESHOLD" ? `<${formatted}` : formatted;
}

/** Derived data health for the Insights header. Stale means the newest stored
 *  data is older than the expected recent window (Google data can lag). */
export type GooglePerformanceHealth =
  "Healthy" | "Stale" | "Unavailable" | "Syncing";

export function googlePerformanceHealth(
  ctx: {
    connection_status: string | null;
    mapping_status: string | null;
    has_any_data: boolean;
    performance_sync_error_code: string | null;
    data_through: string | null;
  } | null,
  expectedThrough: string,
): GooglePerformanceHealth {
  if (!ctx) return "Unavailable";
  if (
    ctx.connection_status !== "connected" ||
    ctx.mapping_status !== "MAPPED"
  ) {
    return "Unavailable";
  }
  if (ctx.performance_sync_error_code) return "Stale";
  if (!ctx.has_any_data) return "Syncing";
  if (!ctx.data_through || ctx.data_through < expectedThrough) return "Stale";
  return "Healthy";
}

/**
 * DARB's own comparison between two periods. Google does not publish this, so
 * the UI labels it "vs previous period". A zero baseline yields null, never
 * infinite growth.
 */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous === 0
  ) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}
