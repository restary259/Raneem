export interface AgePriceTier {
  from_age: number | null;
  to_age: number | null;
  price: number | null;
}

export interface InsuranceLike {
  price?: number | null;
  billing_period?: string | null;
  age_price_tiers?: unknown;
}

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v);

/** Normalise the jsonb rows stored on `insurances.age_price_tiers`. */
export function parseAgeTiers(value: unknown): AgePriceTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const r = row as Record<string, unknown>;
      return { from_age: num(r.from_age), to_age: num(r.to_age), price: num(r.price) };
    });
}

/** The tier whose age band contains `age`, or null. */
export function matchAgeTier(tiers: AgePriceTier[], age: number | null): AgePriceTier | null {
  if (age === null || Number.isNaN(age)) return null;
  return (
    tiers.find((t) => {
      if (t.price === null) return false;
      const from = t.from_age ?? 0;
      const to = t.to_age ?? Number.POSITIVE_INFINITY;
      return age >= from && age <= to;
    }) ?? null
  );
}

/**
 * Monthly premium for a student of `age`.
 * Falls back to the product's base price; returns null when nothing is set,
 * so the UI can say "price not set yet" instead of showing 0.
 */
export function resolveMonthlyRate(insurance: InsuranceLike | null, age: number | null): number | null {
  if (!insurance) return null;
  const tier = matchAgeTier(parseAgeTiers(insurance.age_price_tiers), age);
  if (tier?.price != null && tier.price > 0) return tier.price;
  const base = num(insurance.price);
  return base && base > 0 ? base : null;
}

/** Whole months covered between two dates, minimum 1. Null when either date is missing/invalid. */
export function monthsBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const months =
    (e.getFullYear() - s.getFullYear()) * 12 +
    (e.getMonth() - s.getMonth()) +
    (e.getDate() >= s.getDate() ? 0 : -1);
  return months > 0 ? months : 1;
}

/** Age in whole years from a date of birth, relative to `on` (default today). */
export function ageFromDob(dob?: string | null, on: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = on.getFullYear() - d.getFullYear();
  const beforeBirthday =
    on.getMonth() < d.getMonth() || (on.getMonth() === d.getMonth() && on.getDate() < d.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

export interface InsuranceCost {
  monthly: number | null;
  months: number | null;
  total: number | null;
  tier: AgePriceTier | null;
}

/** Full cost breakdown for an insurance product on a case. */
export function computeInsuranceCost(
  insurance: InsuranceLike | null,
  age: number | null,
  start?: string | null,
  end?: string | null,
): InsuranceCost {
  const monthly = resolveMonthlyRate(insurance, age);
  const months = monthsBetween(start, end);
  const perMonth = (insurance?.billing_period ?? "monthly") === "monthly";
  const total = monthly === null ? null : perMonth && months ? monthly * months : monthly;
  return {
    monthly,
    months,
    total,
    tier: matchAgeTier(parseAgeTiers(insurance?.age_price_tiers), age),
  };
}

/** Human readable ladder, e.g. "0-30: €68 · 31+: €98". */
export function formatAgeLadder(tiers: AgePriceTier[], currencySymbol: string, andAbove: string): string {
  return tiers
    .filter((t) => t.price != null)
    .map((t) => {
      const from = t.from_age ?? 0;
      const range = t.to_age ? `${from}-${t.to_age}` : `${from}+ ${andAbove}`;
      return `${range}: ${currencySymbol}${Number(t.price).toLocaleString("en-US")}`;
    })
    .join(" · ");
}
