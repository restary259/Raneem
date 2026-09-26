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

export const APPLYING_WITH_OPTIONS = [
  { value: "alone", label: "أتقدم لوحدي", labelEn: "I'm applying alone" },
  { value: "friend", label: "أتقدم مع صديق / قريب", labelEn: "I'm applying with a friend / relative" },
];

export const EMPTY_COMPANION = {
  name: "",
  phone: "",
  passportType: "",
  city: "",
  education: "",
  englishUnits: "",
  mathUnits: "",
  preferredMajor: "",
};

export const APPLY_TOTAL_STEPS = 4;
