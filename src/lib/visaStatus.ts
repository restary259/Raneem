import { toneClasses, type StatusTone } from "@/lib/statusTokens";

/**
 * Canonical post-arrival Visa statuses. The operational source of truth is the
 * dynamic field store (`visa_fields.field_key = 'visa_status'` →
 * `visa_field_values.value`) — the SAME data the student Visa page and the
 * admin students sheet already read/write. This module never introduces a
 * second status store; it only names the five values the app already supports
 * and gives them a shared tone/label.
 */
export const VISA_STATUSES = [
  "not_applied",
  "applied",
  "approved",
  "rejected",
  "received",
] as const;

export type VisaStatus = (typeof VISA_STATUSES)[number];

/** Tone per status — reuses the shared semantic status tokens. */
export const VISA_STATUS_TONE: Record<VisaStatus, StatusTone> = {
  not_applied: "neutral",
  applied: "submitted",
  approved: "enrolled",
  rejected: "danger",
  received: "paid",
};

/** Clamp any raw value (legacy / null / unknown) to a known status. */
export function normalizeVisaStatus(
  raw: string | null | undefined,
): VisaStatus {
  return (VISA_STATUSES as readonly string[]).includes(raw ?? "")
    ? (raw as VisaStatus)
    : "not_applied";
}

export function visaStatusClasses(raw: string | null | undefined): string {
  return toneClasses(VISA_STATUS_TONE[normalizeVisaStatus(raw)]).chip;
}

/** Queue buckets, in display order. */
export const VISA_QUEUE_SECTIONS = ["pending", "applied"] as const;

export type VisaQueueSection = (typeof VISA_QUEUE_SECTIONS)[number];

export interface VisaQueueRowLike {
  status?: string;
  student_user_id: string | null;
  actual_arrival: string | null;
  visa_status: string | null;
  visa_applied_at?: string | null;
}

/** Pending until the student submits the Visa file; arrival does not gate this queue. */
export function visaQueueSection(row: VisaQueueRowLike): VisaQueueSection {
  const status = normalizeVisaStatus(row.visa_status);
  return row.visa_applied_at || status !== "not_applied" ? "applied" : "pending";
}

export function groupVisaQueue<T extends VisaQueueRowLike>(
  rows: T[],
): Record<VisaQueueSection, T[]> {
  const out = { pending: [], applied: [] } as Record<VisaQueueSection, T[]>;
  for (const row of rows) out[visaQueueSection(row)].push(row);
  return out;
}

export function visaQueueCounts<T extends VisaQueueRowLike>(
  rows: T[],
): Record<VisaQueueSection, number> {
  const grouped = groupVisaQueue(rows);
  return {
    pending: grouped.pending.length,
    applied: grouped.applied.length,
  };
}

/* ------------------------------------------------------------------ *
 * Readiness helper
 * A heuristic checklist, NOT a legal-advice engine. It only counts data
 * that already exists: configured visa fields, their answers, and the
 * documents the student has actually uploaded. Nothing is invented.
 * ------------------------------------------------------------------ */

export interface ReadinessFieldLike {
  id: string;
  field_key: string;
  field_type: string;
  is_required?: boolean;
  is_active?: boolean;
}

export interface ReadinessDocumentLike {
  id: string;
  category: string;
}

/** Return configured, active required Visa fields that are still unanswered. */
export function missingRequiredVisaFields(
  fields: ReadinessFieldLike[],
  values: Record<string, string>,
): string[] {
  return fields
    .filter(
      (f) =>
        f.is_active !== false &&
        f.is_required === true &&
        f.field_key !== "visa_status" &&
        (values[f.id] ?? "").trim() === "",
    )
    .map((f) => f.field_key);
}

export function missingRequiredVisaDocuments(
  fields: ReadinessFieldLike[],
  values: Record<string, string>,
  documents: ReadinessDocumentLike[],
  selectedDocumentIds: Set<string>,
): string[] {
  const selectedCategories = new Set(
    documents.filter((d) => selectedDocumentIds.has(d.id)).map((d) => d.category),
  );
  const categoryForField: Record<string, string> = {
    bank_statement: "financial",
    health_insurance: "insurance",
    accommodation_proof: "housing",
  };
  return fields
    .filter(
      (f) =>
        f.is_active !== false &&
        f.is_required === true &&
        f.field_type === "boolean" &&
        f.field_key in categoryForField &&
        (values[f.id] ?? "") !== "true" &&
        !selectedCategories.has(categoryForField[f.field_key]),
    )
    .map((f) => f.field_key);
}

export interface VisaReadiness {
  /** Non-empty answers / total active visa fields. */
  fieldsFilled: number;
  fieldsTotal: number;
  /** Count of documents linked to the visa application. */
  documentsSelected: number;
  /** Active visa fields still missing an answer. */
  missingFields: number;
  /** Expected document items not yet satisfied by a selection. */
  missingDocuments: number;
  expectedDocuments: { key: string; fulfilled: boolean }[];
}

/** Field key → the document category that can satisfy the proof it represents. */
const PROOF_FIELD_CATEGORY: Record<string, string> = {
  bank_statement: "financial",
  health_insurance: "insurance",
  accommodation_proof: "housing",
  passport_number: "passport",
  passport_expiry: "passport",
};

/**
 * Expected documents derive ONLY from configured boolean proof fields (e.g.
 * bank_statement / health_insurance / accommodation_proof). The seed data
 * already models these as proof flags, so no legal requirement is hardcoded.
 */
export function expectedProofFields(
  fields: ReadinessFieldLike[],
): ReadinessFieldLike[] {
  return fields.filter(
    (f) =>
      f.is_active !== false &&
      f.field_type === "boolean" &&
      f.field_key in PROOF_FIELD_CATEGORY,
  );
}

export function computeVisaReadiness(
  fields: ReadinessFieldLike[],
  values: Record<string, string>,
  documents: ReadinessDocumentLike[],
  selectedDocumentIds: Set<string>,
): VisaReadiness {
  const active = fields.filter((f) => f.is_active !== false);
  const answerable = active.filter((f) => f.field_key !== "visa_status");
  const fieldsFilled = answerable.filter(
    (f) => (values[f.id] ?? "").trim() !== "",
  ).length;
  const missingFields = answerable.length - fieldsFilled;

  const selectedDocs = documents.filter((d) => selectedDocumentIds.has(d.id));
  const selectedCategories = new Set(selectedDocs.map((d) => d.category));

  const expected = expectedProofFields(active).map((f) => {
    const category = PROOF_FIELD_CATEGORY[f.field_key];
    const flagOk = (values[f.id] ?? "") === "true";
    return {
      key: f.field_key,
      fulfilled: flagOk || selectedCategories.has(category),
    };
  });

  return {
    fieldsFilled,
    fieldsTotal: answerable.length,
    documentsSelected: selectedDocs.length,
    missingFields,
    missingDocuments: expected.filter((e) => !e.fulfilled).length,
    expectedDocuments: expected,
  };
}
