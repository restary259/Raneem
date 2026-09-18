/**
 * Pure helpers for the internal Partner Schools reference tool.
 *
 * All pricing logic lives here so it is testable and never duplicated in JSX.
 * Rule used for course tuition (matches the school's own published examples):
 * the WHOLE booking sits in one weekly band, chosen by the total number of
 * weeks. It is never a progressive/staged calculation.
 */

export interface CoursePriceTier {
  from_weeks: number;
  to_weeks: number | null;
  price_per_week: number;
  kind: string;
}

export interface AccommodationPriceTier {
  from_weeks: number;
  to_weeks: number | null;
  total_price: number | null;
  price_per_week: number | null;
  extra_day_price?: number | null;
}

export interface LevelDuration {
  level: string;
  weeks: number;
  /** Set when the school publishes a range (e.g. teaching-hour ranges). */
  weeks_max?: number | null;
  hours_min?: number | null;
  hours_max?: number | null;
  sort_order: number;
}

export interface CatalogAccommodationLinkInput {
  schoolId: string | null;
  roomType: string | null;
  meals: string | null;
}

export const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1"] as const;
export type CefrLevel = (typeof CEFR_ORDER)[number];

const INCLUDED_ITEM_AR: Record<string, string> = {
  "Personalised lessons in small groups": "دروس مخصصة ضمن مجموعات صغيرة",
  "Cultural and leisure programme": "برنامج ثقافي وترفيهي",
  "10 hours of learning support and exam preparation per week": "10 ساعات أسبوعياً للدعم التعليمي والتحضير للامتحانات",
  "Additional learning materials": "مواد تعليمية إضافية",
  "Placement test": "اختبار تحديد المستوى",
  "Visa and insurance support": "دعم التأشيرة والتأمين",
  "Certificate and student ID card": "شهادة وبطاقة طالب",
  "Free Wi-Fi": "إنترنت لاسلكي مجاني",
  "Free placement test": "اختبار تحديد مستوى مجاني",
  "Free level completion tests": "اختبارات إنهاء المستوى مجاناً",
  "Free certificate of participation": "شهادة مشاركة مجانية",
  "Internal language exam from € 80": "امتحان لغة داخلي ابتداءً من 80 يورو",
  "Internationally recognised language exams from € 180":
    "امتحانات لغة معترف بها دولياً ابتداءً من 180 يورو",
};

/** Converts canonical school inclusions to Arabic without inventing missing facts. */
export function localizeIncludedItem(item: string, lang: "en" | "ar"): string {
  if (lang === "en") return item;
  return INCLUDED_ITEM_AR[item] ?? item;
}

/** Levels a student still has to complete to move from `from` up to `to`. */
export function levelsBetween(from: string, to: string): string[] {
  const start = CEFR_ORDER.indexOf(from as CefrLevel);
  const end = CEFR_ORDER.indexOf(to as CefrLevel);
  if (start < 0 || end < 0 || end < start) return [];
  // Starting AT A1 means A1 still has to be studied; starting at A2 means the
  // student already holds A1, so A2 is the first level they study.
  return CEFR_ORDER.slice(start, end + 1);
}

export interface LevelPlanRow {
  level: string;
  weeks: number;
  /** Upper end when the school publishes a range; equals `weeks` otherwise. */
  weeksMax: number;
  missing: boolean;
}

export function levelPlan(from: string, to: string, durations: LevelDuration[]): LevelPlanRow[] {
  const byLevel = new Map(durations.map((d) => [d.level, d]));
  return levelsBetween(from, to).map((level) => {
    const row = byLevel.get(level);
    const weeks = row?.weeks ?? 0;
    return {
      level,
      weeks,
      weeksMax: row?.weeks_max ?? weeks,
      missing: !row,
    };
  });
}

export function totalWeeks(rows: LevelPlanRow[]): number {
  return rows.reduce((sum, r) => sum + r.weeks, 0);
}

/** Upper end of the plan; equals `totalWeeks` when every level is a fixed duration. */
export function totalWeeksMax(rows: LevelPlanRow[]): number {
  return rows.reduce((sum, r) => sum + (r.weeksMax || r.weeks), 0);
}

/** True when the school publishes durations as a range rather than a fixed number. */
export function isRangePlan(rows: LevelPlanRow[]): boolean {
  return totalWeeksMax(rows) > totalWeeks(rows);
}

/** The single weekly band that applies to a booking of `weeks` weeks. */
export function resolveCourseBand(
  tiers: CoursePriceTier[],
  weeks: number,
  kind: "booking" | "extension" = "booking",
): CoursePriceTier | null {
  if (weeks <= 0) return null;
  const pool = tiers.filter((t) => t.kind === kind);
  const match = pool.find((t) => weeks >= t.from_weeks && (t.to_weeks == null || weeks <= t.to_weeks));
  return match ?? null;
}

export interface CourseQuote {
  weeks: number;
  pricePerWeek: number | null;
  total: number | null;
  band: CoursePriceTier | null;
}

export function quoteCourse(
  tiers: CoursePriceTier[],
  weeks: number,
  kind: "booking" | "extension" = "booking",
): CourseQuote {
  const band = resolveCourseBand(tiers, weeks, kind);
  const pricePerWeek = band?.price_per_week ?? null;
  return {
    weeks,
    pricePerWeek,
    total: pricePerWeek == null ? null : Math.round(pricePerWeek * weeks * 100) / 100,
    band,
  };
}

export interface AccommodationQuote {
  weeks: number;
  total: number | null;
  /** Set when the price came from a per-week rate rather than a fixed total. */
  perWeek: number | null;
  tier: AccommodationPriceTier | null;
}

/**
 * Accommodation pricing: the first weeks may have fixed totals (1, 2, 3, 4
 * weeks), longer stays use a weekly rate from the open-ended tier.
 */
export function quoteAccommodation(
  tiers: AccommodationPriceTier[],
  weeks: number,
): AccommodationQuote {
  if (weeks <= 0) return { weeks: 0, total: 0, perWeek: null, tier: null };
  const tier =
    tiers.find((t) => weeks >= t.from_weeks && (t.to_weeks == null || weeks <= t.to_weeks)) ?? null;
  if (!tier) return { weeks, total: null, perWeek: null, tier: null };
  if (tier.total_price != null) return { weeks, total: tier.total_price, perWeek: null, tier };
  if (tier.price_per_week != null) {
    return {
      weeks,
      total: Math.round(tier.price_per_week * weeks * 100) / 100,
      perWeek: tier.price_per_week,
      tier,
    };
  }
  return { weeks, total: null, perWeek: null, tier };
}

/** Number of whole weeks of a stay that fall inside the school's summer window. */
export function summerWeeks(
  startDate: string | null,
  weeks: number,
  from: string | null,
  to: string | null,
): number {
  if (!startDate || !from || !to || weeks <= 0) return 0;
  const start = new Date(startDate);
  const end = new Date(start.getTime() + weeks * 7 * 86400000);
  const sFrom = new Date(from);
  const sTo = new Date(to);
  const overlapStart = Math.max(start.getTime(), sFrom.getTime());
  const overlapEnd = Math.min(end.getTime(), sTo.getTime() + 86400000);
  if (overlapEnd <= overlapStart) return 0;
  return Math.ceil((overlapEnd - overlapStart) / (7 * 86400000));
}

export function formatEur(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `€${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatBandLabel(
  tier: CoursePriceTier | AccommodationPriceTier,
  lang: "en" | "ar" = "en",
): string {
  const to = tier.to_weeks;
  const unit = lang === "ar" ? "أسبوع" : tier.from_weeks === to && to === 1 ? "week" : "weeks";
  if (to == null) return lang === "ar" ? `${tier.from_weeks}+ ${unit}` : `${tier.from_weeks}+ ${unit}`;
  return tier.from_weeks === to ? `${to} ${unit}` : `${tier.from_weeks}–${to} ${unit}`;
}

/** Arabic month names with Western numerals, or an equally concise English date. */
export function formatSchoolDate(value: string, lang: "en" | "ar"): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * The DARB catalog only stores self-catering rooms, so board options a school
 * arranges (host families with breakfast or half board) have no catalog entry.
 * Returning null keeps the UI honest instead of linking to an empty result.
 */
const CATALOG_MEALS: Record<string, string | null> = {
  none: "self_catering",
  self_catering: "self_catering",
  breakfast: null,
  half_board: null,
  full_board: null,
};

export function partnerSchoolCatalogUrl(input: CatalogAccommodationLinkInput): string | null {
  if (!input.schoolId) return null;
  const meals = input.meals ? CATALOG_MEALS[input.meals] ?? null : null;
  if (input.meals && !meals) return null;
  const params = new URLSearchParams({ school: input.schoolId, tab: "accommodations" });
  if (input.roomType) params.set("roomType", input.roomType);
  if (meals) params.set("meals", meals);
  return `/team/catalog?${params.toString()}`;
}
