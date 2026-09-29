import { describe, it, expect } from "vitest";
import {
  computeVisaReadiness,
  groupVisaQueue,
  missingRequiredVisaDocuments,
  missingRequiredVisaFields,
  normalizeVisaStatus,
  visaQueueCounts,
  visaQueueSection,
  type ReadinessFieldLike,
} from "./visaStatus";

const row = (over: Partial<Parameters<typeof visaQueueSection>[0]>) => ({
  student_user_id: "student-1",
  actual_arrival: "2026-09-14T10:00:00.000Z",
  visa_status: "not_applied",
  ...over,
});

describe("normalizeVisaStatus", () => {
  it("keeps known statuses", () => {
    expect(normalizeVisaStatus("applied")).toBe("applied");
    expect(normalizeVisaStatus("received")).toBe("received");
  });

  it("clamps unknown / legacy / null to not_applied", () => {
    expect(normalizeVisaStatus(null)).toBe("not_applied");
    expect(normalizeVisaStatus(undefined)).toBe("not_applied");
    expect(normalizeVisaStatus("visa_pending")).toBe("not_applied");
    expect(normalizeVisaStatus("")).toBe("not_applied");
  });
});

describe("visaQueueSection", () => {
  it("keeps an enrolled student pending before Visa submission", () => {
    expect(visaQueueSection(row({}))).toBe("pending");
    expect(visaQueueSection(row({ actual_arrival: null }))).toBe("pending");
  });

  it("moves submitted applications to Visa Applied", () => {
    expect(visaQueueSection(row({ visa_status: "applied" }))).toBe("applied");
    expect(
      visaQueueSection(row({ visa_status: "not_applied", visa_applied_at: "2026-09-29T12:00:00.000Z" })),
    ).toBe("applied");
  });

  it("does not use arrival as a queue gate", () => {
    expect(visaQueueSection(row({ actual_arrival: null, visa_status: "not_applied" }))).toBe("pending");
  });

  it("keeps all downstream Visa statuses in the Applied queue", () => {
    expect(visaQueueSection(row({ visa_status: "approved" }))).toBe("applied");
    expect(visaQueueSection(row({ visa_status: "rejected" }))).toBe("applied");
    expect(visaQueueSection(row({ visa_status: "received" }))).toBe("applied");
  });
});

describe("groupVisaQueue / visaQueueCounts", () => {
  const rows = [
    row({ visa_status: "not_applied" }),
    row({ visa_status: "not_applied", actual_arrival: null }),
    row({ visa_status: "applied" }),
    row({ visa_status: "received" }),
  ];

  it("groups without losing rows", () => {
    const grouped = groupVisaQueue(rows);
    expect(grouped.pending).toHaveLength(2);
    expect(grouped.applied).toHaveLength(2);
    expect(Object.values(grouped).flat()).toHaveLength(rows.length);
  });

  it("counts mirror the grouping", () => {
    expect(visaQueueCounts(rows)).toEqual({ pending: 2, applied: 2 });
  });
});

describe("computeVisaReadiness", () => {
  const fields: ReadinessFieldLike[] = [
    { id: "f-status", field_key: "visa_status", field_type: "select" },
    { id: "f-eye", field_key: "eye_color", field_type: "text" },
    { id: "f-exp", field_key: "passport_expiry", field_type: "date" },
    { id: "f-bank", field_key: "bank_statement", field_type: "boolean" },
    { id: "f-ins", field_key: "health_insurance", field_type: "boolean" },
  ];

  it("counts filled fields and excludes the status field from the answer set", () => {
    const r = computeVisaReadiness(
      fields,
      { "f-eye": "brown", "f-exp": "", "f-bank": "true" },
      [],
      new Set(),
    );
    expect(r.fieldsTotal).toBe(4); // eye, expiry, bank, insurance
    expect(r.fieldsFilled).toBe(2); // eye + bank
    expect(r.missingFields).toBe(2);
  });

  it("treats a document selection as satisfying a proof field", () => {
    const docs = [
      { id: "d1", category: "financial" },
      { id: "d2", category: "insurance" },
    ];
    const r = computeVisaReadiness(
      fields,
      { "f-eye": "brown" },
      docs,
      new Set(["d1", "d2"]),
    );
    expect(r.documentsSelected).toBe(2);
    expect(r.missingDocuments).toBe(0);
    expect(r.expectedDocuments.every((e) => e.fulfilled)).toBe(true);
  });

  it("reports missing expected documents when neither flag nor selection exists", () => {
    const r = computeVisaReadiness(fields, {}, [], new Set());
    expect(r.expectedDocuments.map((e) => e.key).sort()).toEqual([
      "bank_statement",
      "health_insurance",
    ]);
    expect(r.missingDocuments).toBe(2);
  });

  it("finds missing required proof documents from configured fields", () => {
    const fields: ReadinessFieldLike[] = [
      { id: "bank", field_key: "bank_statement", field_type: "boolean", is_required: true },
      { id: "ins", field_key: "health_insurance", field_type: "boolean", is_required: true },
      { id: "optional", field_key: "accommodation_proof", field_type: "boolean", is_required: false },
    ];
    expect(
      missingRequiredVisaDocuments(
        fields,
        { bank: "false", ins: "false" },
        [
          { id: "d1", category: "financial" },
          { id: "d2", category: "other" },
        ],
        new Set(["d1"]),
      ),
    ).toEqual(["health_insurance"]);
  });

  it("finds only active required, non-status fields that are missing", () => {
    const fields: ReadinessFieldLike[] = [
      { id: "r1", field_key: "address_abroad", field_type: "text", is_required: true },
      { id: "r2", field_key: "passport_number", field_type: "text", is_required: true },
      { id: "r3", field_key: "visa_status", field_type: "select", is_required: true },
      { id: "r4", field_key: "optional_note", field_type: "text", is_required: false },
    ];
    expect(missingRequiredVisaFields(fields, { r1: "Wilhelmshaven" })).toEqual(["passport_number"]);
  });

  it("ignores inactive fields", () => {
    const withInactive: ReadinessFieldLike[] = [
      {
        id: "f-a",
        field_key: "eye_color",
        field_type: "text",
        is_active: false,
      },
      { id: "f-b", field_key: "nationality", field_type: "text" },
    ];
    const r = computeVisaReadiness(withInactive, {}, [], new Set());
    expect(r.fieldsTotal).toBe(1);
  });
});
