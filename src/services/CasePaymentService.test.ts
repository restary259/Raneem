import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { fn: string; args: any }[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: any) => {
      calls.push({ fn, args });
      return Promise.resolve({
        data: {
          case_id: "c1",
          finance_type: "service_fee",
          status: "confirmed",
          service_total: 5000,
          case_status: "payment_confirmed",
          already_confirmed: false,
        },
        error: null,
      });
    },
  },
}));

import { confirmAgencyServicePayment, recordServiceFeePayment } from "./CasePaymentService";

describe("confirmAgencyServicePayment", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("maps the RPC response shape returned since the payment_flips_status migration", async () => {
    const result = await confirmAgencyServicePayment("c1");
    expect(result).toEqual({
      caseId: "c1",
      financeType: "service_fee",
      status: "confirmed",
      serviceTotal: 5000,
      caseStatus: "payment_confirmed",
      alreadyConfirmed: false,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("confirm_agency_service_payment");
    expect(calls[0].args).toMatchObject({ p_case_id: "c1" });
  });

  it("never accepts a client-supplied amount", async () => {
    await confirmAgencyServicePayment("c1");
    expect(Object.keys(calls[0].args)).toEqual(["p_case_id"]);
  });

  it("tolerates an already-confirmed no-op response", async () => {
    const { alreadyConfirmed, caseStatus } = await confirmAgencyServicePayment("c1");
    expect(alreadyConfirmed).toBe(false);
    expect(caseStatus).toBe("payment_confirmed");
  });

  it("rejects a missing case id", async () => {
    await expect(recordServiceFeePayment({ caseId: "" })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});
