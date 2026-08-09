/**
 * The single definition of the student profile captured for a case.
 *
 * Both entry points — the "+ New student" page and the profile step on the
 * case detail page — read and write this exact shape inside
 * `case_submissions.extra_data`, so the two can never drift apart.
 */

export interface StudentProfileValues {
  first_name: string;
  middle_name: string;
  last_name: string;
  date_of_birth: string; // ISO yyyy-mm-dd
  gender: string;
  city_of_birth: string;

  student_email: string;
  student_phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  street: string;
  house_no: string;
  postcode: string;
  city: string;

  school_id: string;
  program_id: string;
  insurance_id: string;
  accommodation_id: string;
  start_month: string;
  arrival_date: string;
  course_start: string;
  course_end: string;
}

export const EMPTY_STUDENT_PROFILE: StudentProfileValues = {
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  city_of_birth: "",
  student_email: "",
  student_phone: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  street: "",
  house_no: "",
  postcode: "",
  city: "",
  school_id: "",
  program_id: "",
  insurance_id: "",
  accommodation_id: "",
  start_month: "",
  arrival_date: "",
  course_start: "",
  course_end: "",
};

/** Fields a profile must carry before the case can move on to payment. */
export const REQUIRED_PROFILE_FIELDS: (keyof StudentProfileValues)[] = [
  "first_name",
  "last_name",
  "date_of_birth",
  "student_email",
  "student_phone",
  "school_id",
  "program_id",
  "accommodation_id",
  "insurance_id",
  "course_start",
];

/** i18n key (namespace `dashboard`) used to name a field in error messages. */
export const PROFILE_FIELD_LABEL_KEYS: Record<keyof StudentProfileValues, string> = {
  first_name: "case.fields.firstName",
  middle_name: "case.fields.middleName",
  last_name: "case.fields.lastName",
  date_of_birth: "case.fields.dateOfBirth",
  gender: "case.fields.gender",
  city_of_birth: "case.profile.cityOfBirth",
  student_email: "case.fields.studentEmail",
  student_phone: "case.fields.studentPhone",
  emergency_contact_name: "case.profile.emergencyName",
  emergency_contact_phone: "case.profile.emergencyPhone",
  street: "case.fields.street",
  house_no: "case.fields.houseNo",
  postcode: "case.fields.postcode",
  city: "case.fields.city",
  school_id: "case.fields.school",
  program_id: "case.fields.program",
  insurance_id: "case.detail.insurance",
  accommodation_id: "case.detail.accommodation",
  start_month: "case.fields.startMonth",
  arrival_date: "case.fields.arrivalDate",
  course_start: "case.fields.courseStart",
  course_end: "case.fields.courseEnd",
};

/** Every language course runs for exactly this many weeks. */
export const COURSE_DURATION_WEEKS = 40;

/**
 * The only course-end calculation in the system: start + 40 weeks.
 * Returns "" when the start date is missing or unparseable.
 */
export function courseEndFrom(courseStart: string): string {
  if (!courseStart) return "";
  const start = new Date(`${courseStart}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + COURSE_DURATION_WEEKS * 7);
  return end.toISOString().slice(0, 10);
}

/** Trim + lowercase so the same address is never stored two ways. */
export function normalizeEmail(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

/** A phone must be 7–15 digits, optionally prefixed with "+" and spacing. */
export function isValidPhone(phone: string): boolean {
  const raw = String(phone ?? "").trim();
  if (!/^\+?[\d\s()-]+$/.test(raw)) return false;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/** Read the stored profile out of a case row + its submission. */
export function readStudentProfile(
  caseRow: Record<string, unknown> | null,
  submission: Record<string, unknown> | null,
): StudentProfileValues {
  const extra = ((submission?.extra_data as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const nameParts = str(caseRow?.full_name).trim().split(/\s+/).filter(Boolean);

  return {
    first_name: str(extra.first_name) || nameParts[0] || "",
    middle_name: str(extra.middle_name) || (nameParts.length > 2 ? nameParts[1] : ""),
    last_name: str(extra.last_name) || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : ""),
    date_of_birth: str(extra.date_of_birth),
    gender: str(extra.gender),
    city_of_birth: str(extra.city_of_birth),

    // The canonical column wins over the copy kept inside extra_data.
    student_email: str(submission?.student_email) || str(extra.student_email),
    student_phone:
      str(submission?.student_phone) || str(extra.student_phone) || str(caseRow?.phone_number),
    emergency_contact_name: str(extra.emergency_contact_name),
    emergency_contact_phone: str(extra.emergency_contact_phone),
    street: str(extra.street),
    house_no: str(extra.house_no),
    postcode: str(extra.postcode),
    city: str(extra.city) || str(caseRow?.city),

    school_id: str(extra.school_id),
    program_id: str(submission?.program_id) || str(extra.program_id),
    insurance_id: str(submission?.insurance_id) || str(extra.insurance_id),
    accommodation_id: str(submission?.accommodation_id) || str(extra.accommodation_id),
    start_month: str(extra.start_month),
    arrival_date: str(extra.arrival_date),
    course_start: str(submission?.program_start_date) || str(extra.course_start),
    course_end: str(submission?.program_end_date) || str(extra.course_end),
  };
}

/**
 * Serialise the form back into the `extra_data` shape used everywhere.
 * An empty new value never erases a stored one — drafts must not lose work.
 */
export function toExtraData(
  values: StudentProfileValues,
  previous: Record<string, unknown> = {},
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...previous };
  (Object.keys(values) as (keyof StudentProfileValues)[]).forEach((key) => {
    const next = String(values[key] ?? "").trim();
    if (next) merged[key] = next;
    else if (!(key in merged)) merged[key] = "";
  });
  merged.student_email = normalizeEmail(values.student_email) || str(merged.student_email);
  merged.address = [values.street, values.house_no, values.postcode, values.city]
    .filter(Boolean)
    .join(", ");
  return merged;
}

export function fullNameOf(values: StudentProfileValues): string {
  return [values.first_name, values.middle_name, values.last_name].filter(Boolean).join(" ").trim();
}

/** Which required fields are still empty (or, for email/phone, malformed). */
export function missingProfileFields(values: StudentProfileValues): (keyof StudentProfileValues)[] {
  const missing = REQUIRED_PROFILE_FIELDS.filter((f) => !String(values[f] ?? "").trim());
  if (!missing.includes("student_email") && !isValidEmail(values.student_email)) {
    missing.push("student_email");
  }
  if (!missing.includes("student_phone") && !isValidPhone(values.student_phone)) {
    missing.push("student_phone");
  }
  return missing;
}

export function isProfileComplete(values: StudentProfileValues): boolean {
  return missingProfileFields(values).length === 0;
}
