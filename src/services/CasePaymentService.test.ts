import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { fn: string; args: any }[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: any) => {
      calls.push({ fn, args });
      return Promise.resolve({ data: { payment_id: "pay-1", amount_ils: 5000 }, error: null });
    },
  },
}));

import { confirmAgencyServicePayment, recordServiceFeePayment } from "./CasePaymentService";

describe("confirmAgencyServicePayment", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("confirms the fee through the authoritative RPC", async () => {
    const result = await confirmAgencyServicePayment("c1");
    expect(result).toEqual({ paymentId: "pay-1", amountIls: 5000 });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("confirm_agency_service_payment");
    expect(calls[0].args).toMatchObject({ p_case_id: "c1" });
  });

  it("never accepts a client-supplied amount", async () => {
    await confirmAgencyServicePayment("c1");
    expect(Object.keys(calls[0].args)).toEqual(["p_case_id"]);
  });

  it("rejects a missing case id", async () => {
    await expect(recordServiceFeePayment({ caseId: "" })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});
