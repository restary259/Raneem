import { describe, it, expect } from "vitest";
import { selectInvoiceTotals } from "./invoiceTotals";

const service = {
  id: "srv_1",
  description: "Full Service",
  category: "service",
  quantity: 1,
  unit_price: 5000,
  discount: 0,
  currency: "ILS",
  line_total: 5000,
};

describe("selectInvoiceTotals", () => {
  it("passes through a current snapshot with confirmed/remaining", () => {
    const totals = selectInvoiceTotals({
      currency: "ILS",
      services: [service],
      service_total: 5000,
      total_confirmed: 5000,
      remaining: 0,
      payment_type: "agency_service",
    });
    expect(totals.service_total).toBe(5000);
    expect(totals.total_confirmed).toBe(5000);
    expect(totals.remaining).toBe(0);
    expect(totals.services).toHaveLength(1);
    expect(totals.currency).toBe("ILS");
    expect(totals.payment_type).toBe("agency_service");
  });

  it("shows a fully paid invoice as paid and zero remaining", () => {
    const totals = selectInvoiceTotals({
      currency: "ILS",
      services: [service],
      service_total: 5000,
      total_confirmed: 5000,
      payment_type: "agency_service",
    });
    expect(totals.total_confirmed).toBe(5000);
    expect(totals.remaining).toBe(0);
  });

  it("computes remaining for a partially paid invoice", () => {
    const totals = selectInvoiceTotals({
      currency: "ILS",
      services: [service],
      service_total: 5000,
      total_confirmed: 1500,
      payment_type: "agency_service",
    });
    expect(totals.total_confirmed).toBe(1500);
    expect(totals.remaining).toBe(3500);
  });

  it("falls back to paid=0 / remaining=full total for legacy snapshots without payment data", () => {
    const totals = selectInvoiceTotals({
      currency: "ILS",
      services: [service],
      service_total: 5000,
      payment_type: "agency_service",
    });
    expect(totals.total_confirmed).toBe(0);
    expect(totals.remaining).toBe(5000);
  });

  it("never lets remaining go negative", () => {
    const totals = selectInvoiceTotals({
      service_total: 4000,
      total_confirmed: 9000,
    });
    expect(totals.remaining).toBe(0);
  });

  it("treats missing, non-numeric and non-finite values as zero", () => {
    expect(selectInvoiceTotals(undefined).remaining).toBe(0);
    expect(selectInvoiceTotals(null).service_total).toBe(0);
    expect(selectInvoiceTotals("nope").total_confirmed).toBe(0);
    expect(
      selectInvoiceTotals({ service_total: "bad", total_confirmed: Number.NaN }).remaining,
    ).toBe(0);
    expect(selectInvoiceTotals({ service_total: "5000" }).remaining).toBe(5000);
  });

  it("defaults missing services to an empty list", () => {
    const totals = selectInvoiceTotals({ service_total: 5000 });
    expect(totals.services).toEqual([]);
  });
});
