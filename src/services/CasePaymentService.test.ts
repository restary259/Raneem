import { describe, it, expect, vi, beforeEach } from "vitest";

const inserted: any[] = [];
const existingServices: any[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    if (table === "case_payments") {
      return {
        insert: (row: any) => {
          inserted.push(row);
          return Promise.resolve({ error: null });
        },
      };
    }
    if (table === "case_services") {
      return {
        select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: existingServices, error: null }) }) }),
        insert: () => Promise.resolve({ error: null }),
      };
    }
    // service_catalog
    return {
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    };
  };
  return { supabase: { from } };
});

import { recordServiceFeePayment } from "./CasePaymentService";

describe("recordServiceFeePayment", () => {
  beforeEach(() => {
    inserted.length = 0;
    existingServices.length = 0;
  });

  it("records a paid service-fee payment row", async () => {
    await recordServiceFeePayment({ caseId: "c1", actorId: "u1", amount: 5000, paidAt: "2026-01-01" });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      case_id: "c1",
      payment_type: "service_fee",
      amount: 5000,
      paid_status: "paid",
      recorded_by: "u1",
    });
  });

  it("ignores non-positive amounts", async () => {
    await recordServiceFeePayment({ caseId: "c1", actorId: "u1", amount: 0 });
    expect(inserted).toHaveLength(0);
  });
});
