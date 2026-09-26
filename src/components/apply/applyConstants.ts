// Shared constants for the apply form — used by both the public ApplyPage
// and the in-dashboard PartnerApplyPage so the two never drift apart.

export const PASSPORT_TYPES = [
  { value: "israeli_blue", label: "جواز أزرق (إسرائيلي)", labelEn: "Israeli Blue Passport" },
  { value: "israeli_red", label: "جواز أحمر (لم الشمل)", labelEn: "Israeli Red Passport" },
  { value: "other", label: "أخرى", labelEn: "Other" },
];

export const EDUCATION_LEVELS = [
  { value: "bagrut", label: "بجروت (תעודת בגרות)", labelEn: "Bagrut (תעודת בגרות)" },
  { value: "bachelor", label: "بكالوريوس (תואר ראשון)", labelEn: "Bachelor (תואר ראשון)" },
  { value: "master", label: "ماجستר (תואר שני)", labelEn: "Master (תואר שני)" },
  { value: "other", label: "أخرى", labelEn: "Other" },
];

export const UNIT_OPTIONS = ["3", "4", "5"];

export const APPLYING_WITH_OPTIONS = ["alone", "friend", "relative"] as const;
export type ApplyingWith = (typeof APPLYING_WITH_OPTIONS)[number];

/** Marketing copy only — no backend price change is tied to this amount. */
export const GROUP_VALUE_AMOUNT_ILS = 500;

export const EMPTY_COMPANION = {
  name: "",
  phone: "",
  passportType: "",
  city: "",
  education: "",
  englishUnits: "",
  mathUnits: "",
  preferredMajor: "",
  preferredMajorId: null as string | null,
};

export const APPLY_TOTAL_STEPS = 4;
