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

describe("selectInvoiceTotals — invoice email fields", () => {
  const line = (over: Partial<typeof service>) => ({ ...service, ...over });

  it("derives subtotal and discount_total from the frozen service lines", () => {
    const totals = selectInvoiceTotals({
      services: [
        line({ id: "a", unit_price: 2000, quantity: 1, discount: 0, line_total: 2000 }),
        line({ id: "b", unit_price: 175, quantity: 2, discount: 500, line_total: -150 }),
      ],
      service_total: 2850,
      total_confirmed: 1000,
    });
    expect(totals.subtotal).toBe(2350);
    expect(totals.discount_total).toBe(500);
    expect(totals.service_total).toBe(2850);
    expect(totals.remaining).toBe(1850);
  });

  it("falls back to subtotal minus discounts when no service_total is stored", () => {
    const totals = selectInvoiceTotals({
      services: [line({ unit_price: 3000, quantity: 1, discount: 500 })],
    });
    expect(totals.service_total).toBe(2500);
    expect(totals.remaining).toBe(2500);
  });

  it("uses the case price snapshot, never a later catalog price", () => {
    const totals = selectInvoiceTotals({
      services: [line({ unit_price: 2000, quantity: 1, line_total: 2000 })],
      service_total: 2000,
    });
    // catalog may now be 2500 — the snapshot stays authoritative
    expect(totals.services[0].unit_price).toBe(2000);
    expect(totals.service_total).toBe(2000);
  });

  it("keeps EUR school costs out of the ILS totals and drops empty lines", () => {
    const totals = selectInvoiceTotals({
      services: [line({})],
      service_total: 5000,
      total_confirmed: 5000,
      school_costs: [
        { kind: "program", name_en: "Course", name_ar: null, weekly_price: 210, weeks: 20, total: 4200, currency: "EUR" },
        { kind: "insurance", name_en: "Ins", name_ar: null, weekly_price: null, weeks: null, total: 0, currency: "EUR" },
      ],
    });
    expect(totals.school_costs).toHaveLength(1);
    expect(totals.service_total).toBe(5000);
    expect(totals.currency).toBe("ILS");
  });

  it("parses referral_discount from the snapshot and clamps negatives to 0", () => {
    const withDiscount = selectInvoiceTotals({
      services: [line({ unit_price: 5000, quantity: 1 })],
      service_total: 4500,
      referral_discount: 500,
    });
    expect(withDiscount.referral_discount).toBe(500);

    const negative = selectInvoiceTotals({
      service_total: 4500,
      referral_discount: -100,
    });
    expect(negative.referral_discount).toBe(0);

    const missing = selectInvoiceTotals({ service_total: 5000 });
    expect(missing.referral_discount).toBe(0);

    const nonNumeric = selectInvoiceTotals({ service_total: 5000, referral_discount: "bad" });
    expect(nonNumeric.referral_discount).toBe(0);
  });

  it("reconciles subtotal − per-line discount − referral_discount = service_total", () => {
    const totals = selectInvoiceTotals({
      services: [line({ id: "a", unit_price: 3000, quantity: 1, discount: 0, line_total: 3000 })],
      service_total: 2500,
      referral_discount: 500,
    });
    // subtotal(3000) − discount_total(0) − referral_discount(500) = 2500 = service_total
    expect(totals.subtotal).toBe(3000);
    expect(totals.discount_total).toBe(0);
    expect(totals.referral_discount).toBe(500);
    expect(totals.subtotal - totals.discount_total - totals.referral_discount).toBe(totals.service_total);
  });
});
