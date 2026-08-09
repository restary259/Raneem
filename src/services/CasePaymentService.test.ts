import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { fn: string; args: any }[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: any) => {
      calls.push({ fn, args });
      return Promise.resolve({ data: "pay-1", error: null });
    },
  },
}));

import { recordServiceFeePayment } from "./CasePaymentService";

describe("recordServiceFeePayment", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("submits the fee through the authoritative RPC", async () => {
    const id = await recordServiceFeePayment({
      caseId: "c1",
      actorId: "u1",
      amount: 5000,
      paidAt: "2026-01-01",
    });
    expect(id).toBe("pay-1");
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("submit_case_payment");
    expect(calls[0].args).toMatchObject({
      p_case_id: "c1",
      p_amount: 5000,
      p_payment_type: "service_fee",
    });
    // A retry with the same case+amount reuses the key, so the server de-dupes.
    expect(calls[0].args.p_idem_key).toBe("service_fee:c1:5000");
  });

  it("ignores non-positive amounts", async () => {
    await recordServiceFeePayment({ caseId: "c1", actorId: "u1", amount: 0 });
    expect(calls).toHaveLength(0);
  });
});
