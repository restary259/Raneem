export interface Program {
  id: string;
  name_ar: string;
  name_en: string;
  type: string;
  price: number | null;
  currency: string;
  duration: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  lessons_per_week: number | null;
  duration_in_months: number | null;
  fixed_start_day_of_month: number | null;
  school_id: string | null;
  cefr_range: string | null;
  hours_per_week: number | null;
  start_rule: string | null;
  registration_fee: number | null;
  price_tiers: unknown;
  photos: string[] | null;
}

export interface School {
  id: string;
  name_en: string;
  name_ar: string;
  city: string | null;
  country: string;
  is_active: boolean;
  created_at: string;
  photos: string[] | null;
}

export interface Accommodation {
  id: string;
  name_ar: string;
  name_en: string;
  price: number | null;
  currency: string;
  description: string | null;
  is_active: boolean;
  school_id: string | null;
  deposit: number | null;
  placement_fee: number | null;
  meals: string | null;
  room_type: string | null;
  distance_note: string | null;
  price_tiers: unknown;
  photos: string[] | null;
}

export interface Insurance {
  id: string;
  name: string;
  tier: string;
  price: number;
  currency: string;
  is_active: boolean;
  provider?: string | null;
  coverage_scope?: string | null;
  billing_period?: string | null;
  min_months?: number | null;
  max_months?: number | null;
  max_age?: number | null;
  terms_url?: string | null;
  description_ar?: string | null;
  description_en?: string | null;
  age_price_tiers?: unknown;
  photos: string[] | null;
}

/** Pseudo-selection in the school directory for items with no school assigned. */
export const UNASSIGNED_KEY = "unassigned";
