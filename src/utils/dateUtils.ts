/**
 * dateUtils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Canonical date normalization helpers used across all forms.
 * Replaces every broken date-picker usage.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const DOB_MONTHS = [
  { v: "01", l: "January" },
  { v: "02", l: "February" },
  { v: "03", l: "March" },
  { v: "04", l: "April" },
  { v: "05", l: "May" },
  { v: "06", l: "June" },
  { v: "07", l: "July" },
  { v: "08", l: "August" },
  { v: "09", l: "September" },
  { v: "10", l: "October" },
  { v: "11", l: "November" },
  { v: "12", l: "December" },
] as const;

export const DOB_YEARS = Array.from({ length: 2015 - 1940 + 1 }, (_, i) => 1940 + i).reverse();

/**
 * Normalizes day/month/year inputs into ISO 8601 "YYYY-MM-DD" string.
 *
 * @throws Error with human-readable message on any invalid input.
 *
 * @example
 *   normalizeDate(29, 2, 2024)  → "2024-02-29"  (leap year ✓)
 *   normalizeDate(29, 2, 2023)  → throws "Invalid date"
 *   normalizeDate(31, 4, 2026)  → throws "Invalid date"
 */
export function normalizeDate(day: string | number, month: string | number, year: string | number): string {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);

  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) {
    throw new Error("Date fields must be numeric");
  }
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
    throw new Error("Date fields must be whole numbers");
  }
  if (y < 1900 || y > new Date().getFullYear()) {
    throw new Error(`Year must be between 1900 and ${new Date().getFullYear()}`);
  }
  if (m < 1 || m > 12) {
    throw new Error("Month must be between 1 and 12");
  }
  if (d < 1 || d > 31) {
    throw new Error("Day must be between 1 and 31");
  }

  // Use UTC to avoid DST shifts changing the date
  const date = new Date(Date.UTC(y, m - 1, d));

  // If JS rolls over (e.g. Feb 30 → Mar 2), the round-trip will differ
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`Invalid date: ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y} does not exist`);
  }

  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Parses an ISO date string "YYYY-MM-DD" back to { day, month, year } strings.
 * Returns empty strings if input is null/undefined.
 */
export function parseISODate(iso: string | null | undefined): {
  day: string;
  month: string;
  year: string;
} {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { day: "", month: "", year: "" };
  }
  const [year, month, day] = iso.split("-");
  return { day, month, year };
}

/**
 * Returns the number of days in a given month/year (handles leap years).
 */
export function daysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
}

/**
 * Calculates age in whole years from an ISO date string.
 */
export function ageFromISO(iso: string | null | undefined): number | null {
  if (!iso) return null;
  try {
    const birth = new Date(iso);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}
