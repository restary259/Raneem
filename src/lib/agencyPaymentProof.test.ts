import { describe, expect, it } from "vitest";
import { agencyPaymentProofError, receiptStoragePath } from "./agencyPaymentProof";

describe("agencyPaymentProofError", () => {
  it("does not require a reference or receipt for bank transfer", () => {
    expect(agencyPaymentProofError("bank_transfer", "", false)).toBeNull();
    expect(agencyPaymentProofError("bank_transfer", "   ", false)).toBeNull();
  });
  it("accepts bank transfer with a reference or a receipt", () => {
    expect(agencyPaymentProofError("bank_transfer", "TX-123", false)).toBeNull();
    expect(agencyPaymentProofError("bank_transfer", "", true)).toBeNull();
  });
  it("accepts cash with nothing", () => {
    expect(agencyPaymentProofError("cash", null, false)).toBeNull();
  });
  it("rejects over-long references", () => {
    expect(agencyPaymentProofError("cash", "x".repeat(101), false)).toBe("tooLong");
  });
});

describe("receiptStoragePath", () => {
  it("builds the server-accepted path", () => {
    expect(receiptStoragePath("abc", "Receipt.PDF", 5)).toBe("cases/abc/receipts/5.pdf");
  });
});
