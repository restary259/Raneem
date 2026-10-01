import { computeInsuranceCost, ageFromDob } from "@/lib/insurancePricing";
import { computeWeeklyCost, type WeeklyPricedItem } from "@/lib/programPricing";

export type ReferralType = "friend" | "family";

export interface RegistrationFormData {
  referral_type: ReferralType;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  city_of_birth: string;
  nationality: string;
  passport_type: string;
  email: string;
  phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  street: string;
  house_number: string;
  postcode: string;
  city: string;
  education_level: string;
  english_units: string;
  math_units: string;
  english_level: string;
  degree_interest: string;
  preferred_major_id: string;
  school_id: string;
  program_id: string;
  program_weeks: string;
  start_month: string;
  accommodation_id: string;
  accommodation_weeks: string;
  insurance_id: string;
  locale: "ar" | "he" | "en";
}

export interface RegistrationProgram extends WeeklyPricedItem {
  id: string;
  name_en: string;
  name_ar: string;
  description_en?: string | null;
  description_ar?: string | null;
  cefr_range?: string | null;
  lessons_per_week?: number | null;
  hours_per_week?: number | null;
  registration_fee?: number | null;
  school_id: string | null;
}

export interface RegistrationAccommodation extends WeeklyPricedItem {
  id: string;
  name_en: string;
  name_ar: string;
  description_en?: string | null;
  description_ar?: string | null;
  description?: string | null;
  photos?: string[] | null;
  room_type?: string | null;
  meals?: string | null;
  distance_note?: string | null;
  deposit?: number | null;
  placement_fee?: number | null;
  school_id: string | null;
}

export interface RegistrationInsurance {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  billing_period: string | null;
  age_price_tiers: unknown;
}

export interface RegistrationQuote {
  currency: string;
  program: { weeklyRate: number | null; total: number; weeks: number };
  registrationFee: number;
  accommodation: { weeklyRate: number | null; total: number; weeks: number };
  accommodationPlacementFee: number;
  insurance: { monthly: number | null; months: number | null; total: number | null };
  subtotal: number;
}

const clean = (value: string) => value.trim();
const validPhone = (value: string) => /^\+?[\d\s\-()]{7,20}$/.test(value.trim());
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function buildFullName(data: Pick<RegistrationFormData, "first_name" | "middle_name" | "last_name">) {
  return [data.first_name, data.middle_name, data.last_name].map(clean).filter(Boolean).join(" ");
}

export function validateRegistrationForm(data: RegistrationFormData, requireAccommodation = false): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!clean(data.first_name)) errors.first_name = "First name is required";
  if (!clean(data.last_name)) errors.last_name = "Last name is required";
  if (!clean(data.date_of_birth)) errors.date_of_birth = "Date of birth is required";
  if (!validPhone(data.phone)) errors.phone = "Valid phone number is required";
  if (!validEmail(data.email)) errors.email = "Valid email is required";
  if (!data.school_id) errors.school_id = "School is required";
  if (!data.program_id) errors.program_id = "Course is required";
  const weeks = Number(data.program_weeks);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 104) errors.program_weeks = "Course duration must be between 1 and 104 weeks";
  if (!data.start_month) errors.start_month = "Start month is required";
  if (requireAccommodation && !data.accommodation_id) errors.accommodation_id = "Accommodation is required";
  if (data.accommodation_id) {
    const accommodationWeeks = Number(data.accommodation_weeks);
    if (!Number.isInteger(accommodationWeeks) || accommodationWeeks < 1 || accommodationWeeks > 104) {
      errors.accommodation_weeks = "Accommodation duration must be between 1 and 104 weeks";
    }
  }
  if (data.insurance_id && !clean(data.date_of_birth)) errors.insurance_id = "Date of birth is required for insurance";
  return errors;
}

export function calculateRegistrationQuote(
  program: RegistrationProgram | null,
  programWeeks: number,
  accommodation: RegistrationAccommodation | null,
  accommodationWeeks: number,
  insurance: RegistrationInsurance | null,
  dateOfBirth: string,
): RegistrationQuote {
  const programCost = computeWeeklyCost(program, programWeeks);
  const accommodationCost = computeWeeklyCost(accommodation, accommodation ? accommodationWeeks : 0);
  const registrationFee = Number(program?.registration_fee ?? 0);
  const accommodationPlacementFee = Number(accommodation?.placement_fee ?? 0);
  const months = Math.max(1, Math.ceil(programWeeks / 4.33));
  const insuranceCost = insurance
    ? computeInsuranceCost(insurance, ageFromDob(dateOfBirth), null, null, months)
    : { monthly: null, months: null, total: null };

  return {
    currency: program?.currency ?? "EUR",
    program: { weeklyRate: programCost.weeklyRate, total: programCost.total, weeks: programCost.weeks },
    registrationFee,
    accommodation: {
      weeklyRate: accommodationCost.weeklyRate,
      total: accommodationCost.total,
      weeks: accommodationCost.weeks,
    },
    accommodationPlacementFee,
    insurance: {
      monthly: insuranceCost.monthly,
      months: insuranceCost.months,
      total: insuranceCost.total,
    },
    subtotal: programCost.total + registrationFee + accommodationCost.total + accommodationPlacementFee + (insuranceCost.total ?? 0),
  };
}

export function primaryRegistrationPhoto(photos: string[] | null | undefined): string | null {
  return photos?.find((photo) => typeof photo === "string" && photo.trim()) ?? null;
}
