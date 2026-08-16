/**
 * Pure helpers for the Team Catalog presentation layer.
 *
 * The catalog source of truth lives in the `schools` / `accommodations` /
 * `programs` tables (managed by the Admin Catalog — AdminProgramsPage). This
 * module only *reads* those shapes and turns them into display values. It
 * contains no Supabase calls and no React, so it is unit-testable.
 */
import type { Database } from "@/integrations/supabase/types";
import { resolveWeeklyRate, parseWeekTiers, type WeekPriceTier } from "@/lib/programPricing";

export type CatalogSchool = Database["public"]["Tables"]["schools"]["Row"];
export type CatalogAccommodation = Database["public"]["Tables"]["accommodations"]["Row"];

/** Accommodation grouped under its owning school (school_id FK). */
export interface SchoolGroup {
  school: CatalogSchool;
  accommodations: CatalogAccommodation[];
  /** True for the synthetic group holding accommodations with no/unknown school. */
  isOther?: boolean;
}

/**
 * Build school → accommodation groups, preserving the order schools arrive in
 * (ordered by name_en server-side) and ordering accommodations within a school
 * by name_en. Accommodations whose school_id is null or points at a missing
 * school are collected under a synthetic "Other" group last (flagged via
 * `isOther`) so renderers can label it without a sentinel-string check.
 */
export function groupAccommodationsBySchool(
  schools: CatalogSchool[],
  accommodations: CatalogAccommodation[],
): SchoolGroup[] {
  const byId = new Map(schools.map((s) => [s.id, s]));
  const groups: SchoolGroup[] = schools.map((school) => ({
    school,
    accommodations: accommodations
      .filter((a) => a.school_id === school.id)
      .sort((a, b) => a.name_en.localeCompare(b.name_en)),
  }));
  const ungrouped = accommodations.filter((a) => !a.school_id || !byId.has(a.school_id));
  if (ungrouped.length) {
    groups.push({
      isOther: true,
      school: {
        id: "__other__",
        name_en: "Other",
        name_ar: "أخرى",
        city: null,
        country: null,
        slug: null,
        website: null,
        description_en: null,
        description_ar: null,
        photos: [],
        is_active: true,
        created_at: "",
        updated_at: "",
      },
      accommodations: ungrouped.sort((a, b) => a.name_en.localeCompare(b.name_en)),
    });
  }
  return groups.filter((g) => g.accommodations.length > 0);
}

/** The distinct, sorted cities across a set of schools. */
export function distinctCities(schools: CatalogSchool[]): string[] {
  const set = new Set<string>();
  for (const s of schools) if (s.city) set.add(s.city);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export interface CatalogFilter {
  search: string;
  city: string; // "" = all
  schoolId: string; // "" = all
  roomType: string; // "" = all
}

/**
 * Apply the catalog filters (single pass) and return school→accommodation groups.
 *
 * A school is visible only if it passes the city + schoolId filters. An
 * accommodation is visible only if its school passed those filters (orphans —
 * no school_id — are dropped whenever a school/city filter is active), it
 * matches the room-type filter, and its searchable text contains the query.
 * Search matches both the accommodation's own fields and its school's name/city.
 */
export function filterCatalog(
  schools: CatalogSchool[],
  accommodations: CatalogAccommodation[],
  filter: CatalogFilter,
): SchoolGroup[] {
  const q = filter.search.trim().toLowerCase();
  const allowedSchoolIds = new Set(
    schools
      .filter(
        (s) =>
          (!filter.city || s.city === filter.city) &&
          (!filter.schoolId || s.id === filter.schoolId),
      )
      .map((s) => s.id),
  );
  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const visible = accommodations.filter((a) => {
    if (a.school_id && !allowedSchoolIds.has(a.school_id)) return false;
    if (!a.school_id && (filter.schoolId || filter.city)) return false; // orphan dropped under any school/city filter
    if (filter.roomType && a.room_type !== filter.roomType) return false;
    if (q) {
      const school = a.school_id ? schoolById.get(a.school_id) : null;
      const hay = [
        a.name_en, a.name_ar, a.description_en, a.description_ar, a.description,
        school?.name_en, school?.name_ar, school?.city, a.room_type, a.distance_note,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const visibleSchools = schools.filter((s) => allowedSchoolIds.has(s.id));
  return groupAccommodationsBySchool(visibleSchools, visible);
}

/** Canonical room_type values seeded in the catalog, plus a fallback. */
const ROOM_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  single: { en: "Single room", ar: "غرفة مفردة" },
  double: { en: "Double room", ar: "غرفة مزدوجة" },
  shared: { en: "Shared room", ar: "غرفة مشتركة" },
  studio: { en: "Studio", ar: "استوديو" },
  apartment: { en: "Apartment", ar: "شقة" },
};

const MEALS_LABELS: Record<string, { en: string; ar: string }> = {
  self_catering: { en: "Self-catering", ar: "إقامة ذاتية" },
  breakfast: { en: "Breakfast", ar: "فطور" },
  half_board: { en: "Half board", ar: "نصف إقامة" },
  full_board: { en: "Full board", ar: "إقامة كاملة" },
  none: { en: "No meals", ar: "بدون وجبات" },
};

export function roomTypeLabel(value: string | null, lang: "en" | "ar"): string | null {
  if (!value) return null;
  return ROOM_TYPE_LABELS[value]?.[lang] ?? value;
}

export function mealsLabel(value: string | null, lang: "en" | "ar"): string | null {
  if (!value) return null;
  return MEALS_LABELS[value]?.[lang] ?? value;
}

/**
 * The weekly rate to display prominently. When the tier ladder spans a range,
 * "from" must point at the *cheapest* rate (the long-stay discount), never the
 * entry rate — so this returns `cheapestWeeklyRate`. For a flat price it returns
 * that price. Returns null when there is no price at all.
 */
export function displayWeeklyRate(accommodation: CatalogAccommodation): number | null {
  const range = weeklyPriceRange(accommodation);
  if (!range) return null;
  return range[0]; // weeklyPriceRange already returns [min, max]
}

/** Format a weekly price, e.g. "€210". Returns null when no price. */
export function formatWeeklyPrice(
  accommodation: CatalogAccommodation,
): string | null {
  const rate = displayWeeklyRate(accommodation);
  if (rate == null) return null;
  const currency = accommodation.currency || "EUR";
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  // Always Western numerals (0-9) regardless of UI language.
  return `${symbol}${rate.toLocaleString("en-US")}`;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  ILS: "₪",
  USD: "$",
  GBP: "£",
};

/** The lowest weekly rate across the tier ladder (cheapest long-stay tier), or the base price. */
export function cheapestWeeklyRate(accommodation: CatalogAccommodation): number | null {
  const tiers = parseWeekTiers(accommodation.price_tiers).filter((t) => t.price != null);
  if (tiers.length) {
    const min = tiers.reduce((m, t) => Math.min(m, t.price as number), Number.POSITIVE_INFINITY);
    if (Number.isFinite(min)) return min;
  }
  return resolveWeeklyRate(accommodation, null);
}

/** Price range [min, max] across tiers, or [base, base] when a flat price. */
export function weeklyPriceRange(accommodation: CatalogAccommodation): [number, number] | null {
  const tiers = parseWeekTiers(accommodation.price_tiers).filter((t) => t.price != null) as WeekPriceTier[];
  if (tiers.length >= 2) {
    const prices = tiers.map((t) => t.price as number);
    return [Math.min(...prices), Math.max(...prices)];
  }
  const base = resolveWeeklyRate(accommodation, null);
  return base != null ? [base, base] : null;
}

/** A price tier prepared for display: a label and the weekly price. */
export interface PriceTierOption {
  /** Stable key for React lists / selection. */
  key: string;
  /** Human label, e.g. "1-4 weeks", "5+ weeks", "Flat". Western numerals only. */
  label: string;
  /** Weekly price for this tier (null when unknown). */
  price: number | null;
}

/**
 * Build the list of selectable price tiers for an accommodation, ordered by
 * the tier's `from_weeks` ascending (entry tier first). When there are no
 * tiers, returns a single "Flat" option at the base price. Numerals are always
 * Western (0-9).
 */
export function priceTierOptions(accommodation: CatalogAccommodation): PriceTierOption[] {
  const tiers = parseWeekTiers(accommodation.price_tiers)
    .filter((t) => t.price != null)
    .sort((a, b) => (a.from_weeks ?? 1) - (b.from_weeks ?? 1));
  if (tiers.length) {
    return tiers.map((t, i) => {
      const from = t.from_weeks ?? 1;
      const to = t.to_weeks;
      let label: string;
      if (to == null) {
        label = from <= 1 ? "All weeks" : `${from}+ weeks`;
      } else if (from === to) {
        label = `${from} week`;
      } else {
        label = `${from}-${to} weeks`;
      }
      return { key: `tier-${i}`, label, price: t.price };
    });
  }
  const base = resolveWeeklyRate(accommodation, null);
  return [{ key: "flat", label: "Flat", price: base }];
}

/** Format a numeric amount with the accommodation's currency symbol (Western numerals). */
export function formatMoney(rate: number | null, currency: string | null | undefined): string | null {
  if (rate == null) return null;
  const symbol = CURRENCY_SYMBOLS[currency || "EUR"] ?? (currency || "EUR");
  return `${symbol}${rate.toLocaleString("en-US")}`;
}

/**
 * A photos entry is either a Vite public path ("/lovable-uploads/...") or a
 * full Supabase storage URL. Both render directly as <img src>. This returns
 * the first usable photo, or null.
 */
export function primaryPhoto(photos: string[] | null | undefined): string | null {
  if (!photos || photos.length === 0) return null;
  return photos.find((p) => p && p.trim()) ?? null;
}

/** Localized name for a school/accommodation given the active language. */
export function localizedName(
  row: { name_en: string; name_ar: string },
  lang: "en" | "ar",
): string {
  return lang === "ar" ? row.name_ar || row.name_en : row.name_en || row.name_ar;
}

export function localizedDescription(
  row: { description_en: string | null; description_ar: string | null; description: string | null },
  lang: "en" | "ar",
): string | null {
  if (lang === "ar") return row.description_ar || row.description_en || row.description;
  return row.description_en || row.description || row.description_ar;
}
