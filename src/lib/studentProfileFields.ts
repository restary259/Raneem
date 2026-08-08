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
  "program_id",
  "course_start",
];

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

    student_email: str(extra.student_email),
    student_phone: str(extra.student_phone) || str(caseRow?.phone_number),
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

/** Serialise the form back into the `extra_data` shape used everywhere. */
export function toExtraData(
  values: StudentProfileValues,
  previous: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...previous,
    ...values,
    address: [values.street, values.house_no, values.postcode, values.city].filter(Boolean).join(", "),
  };
}

export function fullNameOf(values: StudentProfileValues): string {
  return [values.first_name, values.middle_name, values.last_name].filter(Boolean).join(" ").trim();
}

/** Which required fields are still empty. */
export function missingProfileFields(values: StudentProfileValues): (keyof StudentProfileValues)[] {
  return REQUIRED_PROFILE_FIELDS.filter((f) => !String(values[f] ?? "").trim());
}

export function isProfileComplete(values: StudentProfileValues): boolean {
  return missingProfileFields(values).length === 0;
}
