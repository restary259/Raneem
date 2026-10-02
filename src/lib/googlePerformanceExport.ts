import type {
  GooglePerformanceMetric,
  GooglePerformanceSeriesPoint,
  GoogleSearchKeywordRow,
} from "@/types/googleBusiness";

/**
 * Phase 8 export builder.
 *
 * The export is deliberately office-scoped by the caller (the server function
 * only ever returns one office's rows), and every row carries its Google
 * location so an exported file is self-describing. Threshold keywords keep the
 * "<N" form: an export must not launder a threshold into an exact number.
 */

export type PerformanceExportContext = {
  officeName: string | null;
  googleLocationName: string | null;
  /** Human label for a metric, resolved by the caller from i18n. */
  metricLabel: (metric: GooglePerformanceMetric) => string;
};

function formatThreshold(
  value: number,
  type: "VALUE" | "THRESHOLD",
): string | number {
  return type === "THRESHOLD" ? `<${value}` : value;
}

/**
 * Builds export rows for the shared CSV writer. One flat table so there is a
 * single export control, not one per section.
 */
export function buildPerformanceExportRows(
  series: GooglePerformanceSeriesPoint[],
  keywords: GoogleSearchKeywordRow[],
  ctx: PerformanceExportContext,
): Record<string, unknown>[] {
  const office = ctx.officeName ?? "";
  const location = ctx.googleLocationName ?? "";

  return [
    ...series.map((point) => ({
      Date: point.metric_date,
      Office: office,
      Metric: ctx.metricLabel(point.metric),
      Value: point.metric_value,
      "Google Location": location,
      "Search Keyword": "",
      Month: "",
    })),
    ...keywords.map((row) => ({
      Date: "",
      Office: office,
      Metric: "",
      Value: formatThreshold(row.insights_value, row.insights_value_type),
      "Google Location": location,
      "Search Keyword": row.search_keyword,
      Month: row.month,
    })),
  ];
}

/** Suggested file name, office- and range-scoped. */
export function performanceExportFileName(
  officeName: string | null,
  startDate: string,
  endDate: string,
): string {
  const slug =
    (officeName ?? "office")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "office";
  return `google-performance-${slug}-${startDate}_${endDate}`;
}
