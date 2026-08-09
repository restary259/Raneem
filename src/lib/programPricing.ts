/**
 * Week-based pricing for language programmes and accommodation.
 *
 * Schools quote a *weekly* rate that gets cheaper the longer the student
 * stays (`price_tiers` on `programs` / `accommodations`). The catalogue's
 * `price` column is the entry weekly rate, never the total — a 40-week course
 * at €200/week costs €8,000, so every total in the app must be derived here
 * rather than read straight off `price`.
 */

export interface WeekPriceTier {
  from_weeks: number | null;
  to_weeks: number | null;
  price: number | null;
}

export interface WeeklyPricedItem {
  price?: number | null;
  currency?: string | null;
  price_tiers?: unknown;
}

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v);

/** Normalise the jsonb rows stored on `price_tiers`. */
export function parseWeekTiers(value: unknown): WeekPriceTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const r = row as Record<string, unknown>;
      return { from_weeks: num(r.from_weeks), to_weeks: num(r.to_weeks), price: num(r.price) };
    })
    .filter((t) => t.price !== null);
}

/** The weekly rate that applies to a stay of `weeks`, or null when unknown. */
export function resolveWeeklyRate(item: WeeklyPricedItem | null | undefined, weeks: number | null): number | null {
  if (!item) return null;
  const tiers = parseWeekTiers(item.price_tiers);
  if (weeks && weeks > 0) {
    const tier = tiers.find((t) => {
      const from = t.from_weeks ?? 1;
      const to = t.to_weeks ?? Number.POSITIVE_INFINITY;
      return weeks >= from && weeks <= to;
    });
    if (tier?.price != null) return tier.price;
  }
  const base = num(item.price);
  return base && base > 0 ? base : null;
}

export interface WeeklyCost {
  weeks: number;
  weeklyRate: number | null;
  total: number;
  currency: string;
}

/** Weekly rate × weeks, with the currency the school bills in. */
export function computeWeeklyCost(
  item: WeeklyPricedItem | null | undefined,
  weeks: number | null | undefined,
): WeeklyCost {
  const w = weeks && weeks > 0 ? Math.round(weeks) : 0;
  const weeklyRate = resolveWeeklyRate(item, w || null);
  return {
    weeks: w,
    weeklyRate,
    total: weeklyRate && w ? weeklyRate * w : 0,
    currency: item?.currency ?? "EUR",
  };
}

/** Whole weeks between two ISO dates (rounded up), or null. */
export function weeksBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.max(1, Math.ceil((e - s) / (7 * 24 * 60 * 60 * 1000)));
}

/** ISO end date for a course that starts on `start` and runs `weeks` weeks. */
export function endDateForWeeks(start?: string | null, weeks?: number | null): string | null {
  if (!start || !weeks || weeks <= 0) return null;
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

/** Formats a money amount with ASCII digits and an explicit currency code. */
export function formatMoney(amount: number, currency = "EUR"): string {
  return `${Number(amount || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
}
