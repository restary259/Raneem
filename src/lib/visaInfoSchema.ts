/**
 * Student "Visa Information" wizard definition. Shared by the student wizard
 * and the team/admin read-only review so both stay in the same shape.
 * Labels are i18n keys under `visaInfo.f.<key>`; option labels under
 * `visaInfo.o.<option>`.
 */
export type VisaFieldType = "text" | "date" | "select" | "yesno" | "textarea" | "number";

export interface VisaInfoField {
  key: string;
  type: VisaFieldType;
  required?: boolean;
  options?: string[];
  /** German form term shown to staff beside the label. */
  de?: string;
  /** Only shown (and validated) when another field in the same section equals the value. */
  showIf?: { key: string; equals: string };
  group?: string;
}

export interface VisaInfoStep {
  id: "personal" | "family" | "contact" | "passport" | "travel" | "previous" | "background" | "financing";
  fields: VisaInfoField[];
  optional?: boolean;
}

export type VisaInfoStatus = "draft" | "in_progress" | "submitted" | "needs_correction" | "checked";
export type VisaInfoData = Record<string, Record<string, string>>;

const YES = { equals: "yes" };
const explain = (key: string): VisaInfoField[] => [
  { key: `${key}_details`, type: "textarea", required: true, showIf: { key, ...YES } },
  { key: `${key}_date`, type: "text", showIf: { key, ...YES } },
  { key: `${key}_authority`, type: "text", showIf: { key, ...YES } },
];

export const VISA_INFO_STEPS: VisaInfoStep[] = [
  {
    id: "personal",
    fields: [
      { key: "first_names", type: "text", required: true, de: "Vorname(n)" },
      { key: "surname", type: "text", required: true, de: "Familienname" },
      { key: "birth_surname", type: "text", de: "Geburtsname" },
      { key: "date_of_birth", type: "date", required: true, de: "Geburtsdatum" },
      { key: "place_of_birth", type: "text", required: true, de: "Geburtsort" },
      { key: "country_of_birth", type: "text", required: true, de: "Geburtsland" },
      { key: "sex", type: "select", required: true, options: ["male", "female", "diverse"], de: "Geschlecht" },
      { key: "marital_status", type: "select", required: true, options: ["single", "married", "divorced", "widowed"], de: "Familienstand" },
      { key: "nationality", type: "text", required: true, de: "Staatsangehörigkeit" },
      { key: "former_nationality", type: "text", de: "Frühere Staatsangehörigkeit" },
      { key: "has_children", type: "yesno", required: true, de: "Kinder" },
      { key: "height_cm", type: "number", de: "Größe (cm)" },
      { key: "eye_color", type: "select", options: ["brown", "blue", "green", "hazel", "gray", "other"], de: "Augenfarbe" },
    ],
  },
  {
    id: "family",
    optional: true,
    fields: (["father", "mother"] as const).flatMap((p) => [
      { key: `${p}_surname`, type: "text" as const, group: p, de: "Familienname" },
      { key: `${p}_first_names`, type: "text" as const, group: p, de: "Vorname(n)" },
      { key: `${p}_nationality`, type: "text" as const, group: p, de: "Staatsangehörigkeit" },
      { key: `${p}_date_of_birth`, type: "date" as const, group: p, de: "Geburtsdatum" },
      { key: `${p}_place_of_birth`, type: "text" as const, group: p, de: "Geburtsort" },
      { key: `${p}_residence`, type: "text" as const, group: p, de: "Wohnort" },
    ]),
  },
  {
    id: "contact",
    fields: [
      { key: "street", type: "text", required: true, de: "Straße" },
      { key: "house_number", type: "text", required: true, de: "Hausnummer" },
      { key: "address_extra", type: "text", de: "Adresszusatz" },
      { key: "postal_code", type: "text", required: true, de: "Postleitzahl" },
      { key: "city", type: "text", required: true, de: "Ort" },
      { key: "country", type: "text", required: true, de: "Land" },
      { key: "phone", type: "text", required: true, de: "Telefon" },
      { key: "email", type: "text", required: true, de: "E-Mail" },
    ],
  },
  {
    id: "passport",
    fields: [
      { key: "document_type", type: "select", required: true, options: ["passport", "travel_document", "other"], de: "Art des Reisedokuments" },
      { key: "passport_number", type: "text", required: true, de: "Passnummer" },
      { key: "issue_date", type: "date", required: true, de: "Ausstellungsdatum" },
      { key: "expiry_date", type: "date", required: true, de: "Gültig bis" },
      { key: "issuing_country", type: "text", required: true, de: "Ausstellungsstaat" },
      { key: "issuing_authority", type: "text", de: "Ausstellende Behörde" },
    ],
  },
  {
    id: "travel",
    fields: [
      { key: "purpose", type: "select", required: true, options: ["language_course", "other"], de: "Zweck des Aufenthalts" },
      { key: "arrival_date", type: "date", required: true, de: "Geplante Einreise" },
      { key: "departure_date", type: "date", de: "Geplante Ausreise" },
      { key: "duration", type: "text", required: true, de: "Aufenthaltsdauer" },
      { key: "german_city", type: "text", required: true, de: "Wohnort in Deutschland" },
      { key: "german_address", type: "text", de: "Anschrift in Deutschland" },
      { key: "accommodation_type", type: "select", required: true, options: ["single_room", "apartment", "shared", "other"], de: "Unterkunft" },
      { key: "keeps_home_residence", type: "yesno", required: true, de: "Wohnsitz im Ausland beibehalten" },
      { key: "family_accompanying", type: "yesno", required: true, de: "Begleitende Familienangehörige" },
      { key: "health_insurance", type: "select", required: true, options: ["yes", "no", "not_yet"], de: "Krankenversicherung" },
    ],
  },
  {
    id: "previous",
    fields: [
      { key: "been_to_germany", type: "yesno", required: true, de: "Frühere Aufenthalte in Deutschland" },
      { key: "previous_period", type: "text", required: true, showIf: { key: "been_to_germany", ...YES }, de: "Zeitraum" },
      { key: "previous_purpose", type: "text", showIf: { key: "been_to_germany", ...YES }, de: "Zweck" },
      { key: "previous_cities", type: "text", showIf: { key: "been_to_germany", ...YES }, de: "Orte" },
      { key: "previous_address", type: "text", showIf: { key: "been_to_germany", ...YES }, de: "Frühere Anschrift" },
    ],
  },
  {
    id: "background",
    fields: [
      { key: "convicted", type: "yesno", required: true, de: "Verurteilungen" },
      ...explain("convicted"),
      { key: "deported", type: "yesno", required: true, de: "Ausweisung / Abschiebung" },
      ...explain("deported"),
      { key: "permit_rejected", type: "yesno", required: true, de: "Abgelehnter Aufenthaltstitel" },
      ...explain("permit_rejected"),
      { key: "entry_refused", type: "yesno", required: true, de: "Einreiseverweigerung" },
      ...explain("entry_refused"),
    ],
  },
  {
    id: "financing",
    fields: [
      { key: "living_funded_by", type: "select", required: true, options: ["self", "family", "sponsor", "scholarship", "commitment", "other"], de: "Finanzierung des Lebensunterhalts" },
      { key: "sponsor_name", type: "text", required: true, showIf: { key: "living_funded_by", equals: "sponsor" }, de: "Name des Sponsors" },
      { key: "travel_paid_by", type: "text", required: true, de: "Reisekosten getragen von" },
      { key: "living_paid_by", type: "text", required: true, de: "Lebenshaltungskosten getragen von" },
      { key: "financial_notes", type: "textarea", de: "Weitere Angaben" },
    ],
  },
];

export const TOTAL_VISA_STEPS = VISA_INFO_STEPS.length + 1; // + review

export function isFieldVisible(field: VisaInfoField, section: Record<string, string>): boolean {
  return !field.showIf || section[field.showIf.key] === field.showIf.equals;
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Returns field key → i18n error key. Empty object means the step is valid. */
export function validateStep(step: VisaInfoStep, section: Record<string, string> = {}, today = todayIso()): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of step.fields) {
    if (!isFieldVisible(f, section)) continue;
    const v = (section[f.key] ?? "").trim();
    if (v === "") {
      if (f.required) errors[f.key] = "required";
      continue;
    }
    if (f.type === "date" && !isoDate.test(v)) errors[f.key] = "invalidDate";
    if (f.type === "number" && f.key === "height_cm") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 100 || n > 250) errors[f.key] = "invalidHeight";
    }
    if (f.key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors[f.key] = "invalidEmail";
    if (f.key === "passport_number" && !/^[A-Za-z0-9]{5,20}$/.test(v)) errors[f.key] = "invalidPassport";
  }
  if (step.id === "passport" && section.issue_date && section.expiry_date && !errors.issue_date && !errors.expiry_date
      && section.expiry_date <= section.issue_date) {
    errors.expiry_date = "expiryBeforeIssue";
  }
  if (step.id === "travel") {
    if (section.arrival_date && !errors.arrival_date && section.arrival_date < today) errors.arrival_date = "pastArrival";
    if (section.arrival_date && section.departure_date && !errors.departure_date && section.departure_date <= section.arrival_date) {
      errors.departure_date = "departureBeforeArrival";
    }
  }
  return errors;
}

export function completedSteps(data: VisaInfoData, today = todayIso()): number {
  return VISA_INFO_STEPS.filter((s) => {
    const sec = data[s.id];
    if (!sec || Object.keys(sec).length === 0) return false;
    return Object.keys(validateStep(s, sec, today)).length === 0;
  }).length;
}

export function isLocked(status: VisaInfoStatus | null | undefined): boolean {
  return status === "submitted" || status === "checked";
}
