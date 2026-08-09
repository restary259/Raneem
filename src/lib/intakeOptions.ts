/**
 * Intake option value sets shared by the public Apply flow, the team
 * "Submit new student" wizard and the case profile form. Values are the exact
 * strings persisted to `cases.education_level` / `cases.passport_type`; labels
 * are resolved through i18n (`case.educationLevels.*`, `case.passportTypes.*`)
 * so the same code renders correctly in Arabic and English.
 */
export const EDUCATION_LEVEL_VALUES = ["bagrut", "bachelor", "master", "other"] as const;

export const PASSPORT_TYPE_VALUES = [
  "israeli_blue",
  "israeli_red",
  "palestinian",
  "jordanian",
  "other",
] as const;

export type EducationLevel = (typeof EDUCATION_LEVEL_VALUES)[number];
export type PassportType = (typeof PASSPORT_TYPE_VALUES)[number];
