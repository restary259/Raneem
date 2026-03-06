/**
 * intakeMonths.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates intake month options starting from the CURRENT server month
 * (not a hardcoded past year).
 *
 * Uses Asia/Jerusalem timezone to determine "current month".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { addMonths, format } from "date-fns";

export interface MonthOption {
  value: string;  // "YYYY-MM"
  label: string;  // "March 2026"
}

/**
 * Returns an array of month options starting from the current month
 * (in Asia/Jerusalem timezone) and extending `count` months into the future.
 *
 * @param count  Number of months to generate (default 24)
 * @returns      Array of { value: "YYYY-MM", label: "Month YYYY" }
 *
 * @example
 *   generateIntakeMonths()
 *   // If today is March 2026:
 *   // [{ value: "2026-03", label: "March 2026" }, { value: "2026-04", label: "April 2026" }, ...]
 */
export function generateIntakeMonths(count = 24): MonthOption[] {
  // Determine current month in Asia/Jerusalem timezone
  // We use Intl.DateTimeFormat to get the year/month in the correct tz
  const nowUTC = new Date();

  let startYear: number;
  let startMonth: number; // 0-indexed

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "numeric",
    });
    const parts = formatter.formatToParts(nowUTC);
    const yearPart = parts.find((p) => p.type === "year")?.value;
    const monthPart = parts.find((p) => p.type === "month")?.value;
    startYear = parseInt(yearPart ?? String(nowUTC.getFullYear()), 10);
    startMonth = parseInt(monthPart ?? String(nowUTC.getMonth() + 1), 10) - 1; // convert to 0-indexed
  } catch {
    // Fallback to UTC if Intl is unavailable
    startYear = nowUTC.getUTCFullYear();
    startMonth = nowUTC.getUTCMonth();
  }

  const startDate = new Date(startYear, startMonth, 1);

  return Array.from({ length: count }, (_, i) => {
    const d = addMonths(startDate, i);
    return {
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy"),
    };
  });
}

/**
 * Returns the value string for the current month in Asia/Jerusalem.
 * Useful for setting a default filter value.
 */
export function currentMonthValue(): string {
  const opts = generateIntakeMonths(1);
  return opts[0]?.value ?? format(new Date(), "yyyy-MM");
}
