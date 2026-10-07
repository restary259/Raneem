const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns the final scheduled class day for a course measured in teaching
 * weeks. School start dates can move to Tuesday after a Monday closure, so
 * each teaching week ends on Friday rather than assuming every start is Monday.
 */
export function calculateCourseEndDate(
  startDate: string | null | undefined,
  weeks: string | number | null | undefined,
): string | null {
  const start = parseIsoDate((startDate ?? "").trim());
  const duration = typeof weeks === "number" ? weeks : Number(weeks);
  if (!start || !Number.isInteger(duration) || duration <= 0) return null;

  const day = start.getUTCDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  start.setUTCDate(start.getUTCDate() + (duration - 1) * 7 + daysUntilFriday);
  return toIsoDate(start);
}

/** Preserve a selected date only while it belongs to the newly loaded school. */
export function retainOfficialStartDate(value: string, officialDates: string[]): string {
  return officialDates.includes(value) ? value : "";
}

export function formatCourseDate(value: string | null | undefined): string {
  const date = parseIsoDate((value ?? "").slice(0, 10));
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}