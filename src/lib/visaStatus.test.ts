import { describe, it, expect } from "vitest";
import {
  computeVisaReadiness,
  groupVisaQueue,
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
  it("places an arrived, not-applied student in Ready (scenario 1)", () => {
    expect(visaQueueSection(row({}))).toBe("ready");
  });

  it("places an enrolled student with no arrival in Missing Arrival (scenario 2)", () => {
    expect(visaQueueSection(row({ actual_arrival: null }))).toBe(
      "missingArrival",
    );
  });

  it("places a student with no account in Missing Arrival", () => {
    expect(visaQueueSection(row({ student_user_id: null }))).toBe(
      "missingArrival",
    );
  });

  it("routes application progress out of the arrival buckets", () => {
    expect(
      visaQueueSection(row({ visa_status: "applied", actual_arrival: null })),
    ).toBe("inProgress");
    expect(
      visaQueueSection(row({ visa_status: "approved", actual_arrival: null })),
    ).toBe("approved");
    expect(
      visaQueueSection(row({ visa_status: "rejected", actual_arrival: null })),
    ).toBe("rejected");
    expect(
      visaQueueSection(row({ visa_status: "received", actual_arrival: null })),
    ).toBe("received");
  });

  it("completion never depends on a case status change", () => {
    // The row shape has no `status` field at all — the queue is enrollment_paid
    // by construction, and received is a purely visa-side terminal state.
    expect(
      visaQueueSection({
        student_user_id: "s",
        actual_arrival: null,
        visa_status: "received",
      }),
    ).toBe("received");
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
    expect(grouped.ready).toHaveLength(1);
    expect(grouped.missingArrival).toHaveLength(1);
    expect(grouped.inProgress).toHaveLength(1);
    expect(grouped.received).toHaveLength(1);
    expect(grouped.approved).toHaveLength(0);
    expect(Object.values(grouped).flat()).toHaveLength(rows.length);
  });

  it("counts mirror the grouping", () => {
    const counts = visaQueueCounts(rows);
    expect(counts).toEqual({
      ready: 1,
      inProgress: 1,
      approved: 0,
      rejected: 0,
      received: 1,
      missingArrival: 1,
    });
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
