/**
 * Maps the details already stored on a student's case (case row +
 * case_submissions) onto the shape the student onboarding wizard edits, so a
 * student who was submitted by the team only has to CONFIRM what we already
 * know instead of retyping it.
 *
 * Pure + unit-tested: the wizard does the reading/writing, this file only maps
 * and merges. Nothing here overwrites a value the student already has on their
 * own account — case data fills blanks only.
 */
import { readStudentProfile } from "@/lib/studentProfileFields";

export interface PrefillContact {
  name: string;
  relationship: string;
  phone: string;
}

/** The subset of the wizard's profile shape that a case can supply. */
export interface CasePrefill {
  full_name?: string;
  phone_number?: string;
  date_of_birth?: string;
  gender?: string;
  city?: string;
  street?: string;
  house_number?: string;
  residential_city?: string;
  language_school_id?: string;
  intake_month?: string;
}

export interface CasePrefillResult {
  values: CasePrefill;
  /** First emergency contact taken from the case, when present. */
  contact: PrefillContact | null;
  /** True when the case supplied at least one usable value. */
  hasData: boolean;
}

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Build the prefill from a case row + its submission.
 *
 * @param activeSchoolIds ids currently offered in the wizard's school dropdown;
 *        a stored school that is no longer active is ignored so the Select can
 *        never hold an unknown value.
 */
export function buildCasePrefill(
  caseRow: Record<string, unknown> | null,
  submission: Record<string, unknown> | null,
  activeSchoolIds: string[] = [],
): CasePrefillResult {
  if (!caseRow && !submission) return { values: {}, contact: null, hasData: false };

  const stored = readStudentProfile(caseRow, submission);
  const values: CasePrefill = {};

  const fullName = clean(caseRow?.full_name) ||
    [stored.first_name, stored.middle_name, stored.last_name].map(clean).filter(Boolean).join(" ");
  if (fullName) values.full_name = fullName;

  const phone = clean(stored.student_phone) || clean(caseRow?.phone_number);
  if (phone) values.phone_number = phone;

  if (clean(stored.date_of_birth)) values.date_of_birth = clean(stored.date_of_birth);
  if (clean(stored.gender)) values.gender = clean(stored.gender);
  if (clean(stored.city_of_birth)) values.city = clean(stored.city_of_birth);
  if (clean(stored.street)) values.street = clean(stored.street);
  if (clean(stored.house_no)) values.house_number = clean(stored.house_no);
  if (clean(stored.city)) values.residential_city = clean(stored.city);
  if (clean(stored.start_month)) values.intake_month = clean(stored.start_month);

  const schoolId = clean(stored.school_id);
  if (schoolId && activeSchoolIds.includes(schoolId)) values.language_school_id = schoolId;

  const contactName = clean(stored.emergency_contact_name);
  const contactPhone = clean(stored.emergency_contact_phone);
  const contact = contactName && contactPhone
    ? { name: contactName, relationship: "", phone: contactPhone }
    : null;

  return { values, contact, hasData: Object.keys(values).length > 0 || !!contact };
}

/**
 * Case data fills blanks only — anything already saved on the student's own
 * account wins, so confirming can never silently replace their own edits.
 */
export function mergeCasePrefill<T extends object>(profile: T, prefill: CasePrefill): T {
  const out: Record<string, unknown> = { ...profile };
  for (const [key, value] of Object.entries(prefill)) {
    const current = out[key];
    const currentFilled = typeof current === "string" && current.trim().length > 0;
    if (!currentFilled && value) out[key] = value;
  }
  return out as T;
}
