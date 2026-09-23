import { describe, expect, it } from "vitest";
import { createInvoicePresentation, invoicePdfFileName } from "./invoicePresentation";

const meta = { invoiceNumber: "DRB-INV-42", caseReference: "DRB-42", studentName: "Student", issuedAt: "2026-09-23" };
const totals = {
  currency: "ILS",
  services: [{ id: "1", description: "Application support", category: "service", quantity: 2, unit_price: 500, discount: 100, currency: "ILS", line_total: 900 }],
  service_total: 700,
  referral_discount: 200,
  total_confirmed: 700,
  school_costs: [{ kind: "program", name_ar: "دورة", name_en: "Course", weekly_price: null, weeks: null, total: 4200, currency: "EUR" }],
};

describe("invoice presentation", () => {
  it("derives one reconciled paid invoice model", () => {
    const view = createInvoicePresentation(meta, totals, false);
    expect(view.totals.subtotal).toBe(1000);
    expect(view.totals.discount_total).toBe(100);
    expect(view.totals.referral_discount).toBe(200);
    expect(view.totals.remaining).toBe(0);
    expect(view.fullyPaid).toBe(true);
  });

  it("provides natural Arabic labels and keeps provider costs outside the invoice rows", () => {
    const view = createInvoicePresentation(meta, totals, true);
    expect(view.labels.title).toBe("فاتورة خدمات درب");
    expect(view.labels.separationNote).toContain("منفصلة");
    expect(view.totals.services).toHaveLength(1);
    expect(view.totals.school_costs).toHaveLength(1);
  });

  it("creates exactly one PDF suffix", () => {
    expect(invoicePdfFileName("DRB-INV-42")).toBe("DRB-INV-42.pdf");
    expect(invoicePdfFileName("DRB-INV-42.pdf")).toBe("DRB-INV-42.pdf");
  });
});