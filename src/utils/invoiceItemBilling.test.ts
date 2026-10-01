import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatInvoiceItemBilling } from "@/utils/invoicePresentation";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("formatInvoiceItemBilling", () => {
  it("labels a weekly item with its per-week rate", () => {
    expect(
      formatInvoiceItemBilling({ weeks: 3, weekly_price: 245 }, "EUR", false),
    ).toBe("3 weeks · €245.00/week");
  });

  it("singularises a single week", () => {
    expect(formatInvoiceItemBilling({ weeks: 1, weekly_price: 200 }, "EUR", false)).toBe(
      "1 week · €200.00/week",
    );
  });

  it("labels a monthly item with its per-month rate", () => {
    expect(
      formatInvoiceItemBilling({ months: 6, monthly_price: 98, billing_period: "monthly" }, "EUR", false),
    ).toBe("6 months · €98.00/month");
  });

  it("does not describe a one_time premium as monthly", () => {
    // Regression: a one-off premium was rendered as "1 month · €500.00/month",
    // which reads as a recurring charge even though it is billed once.
    const line = formatInvoiceItemBilling(
      { months: 1, monthly_price: 500, billing_period: "one_time" },
      "EUR",
      false,
    );
    expect(line).toBe("one-time · €500.00");
    expect(line).not.toContain("/month");
    expect(line).not.toContain("1 month");
  });

  it("treats any non-monthly billing period as one-time", () => {
    expect(
      formatInvoiceItemBilling({ months: 1, monthly_price: 500, billing_period: "per_semester" }, "EUR", false),
    ).toBe("one-time · €500.00");
  });

  it("localises the units for Arabic", () => {
    const line = formatInvoiceItemBilling(
      { months: 1, monthly_price: 500, billing_period: "one_time" },
      "EUR",
      true,
    );
    expect(line).toContain("دفعة واحدة");
    expect(line).not.toContain("/شهر");
  });

  it("returns an empty string when the item has no duration", () => {
    expect(formatInvoiceItemBilling({}, "EUR", false)).toBe("");
  });
});

describe("email template billing copy stays in step with the frontend", () => {
  const template = read("supabase/functions/_shared/transactional-email-templates/student-registration-invoice.tsx");
  const frontend = read("src/utils/invoicePresentation.ts");

  // The Deno edge function cannot import from src/, so the wording is duplicated
  // on purpose. This is the drift guard that makes the duplication safe.
  const localeLine = (source: string, locale: string) =>
    source.match(new RegExp(`\\b${locale}:\\s*\\{([^}]*)\\}`))?.[1] ?? "";

  it.each(["en", "ar"])("uses the same %s billing wording in both copies", (locale) => {
    const templateLine = localeLine(template, locale);
    const frontendLine = localeLine(frontend, locale);
    expect(templateLine).not.toBe("");
    expect(frontendLine).not.toBe("");
    for (const field of ["week", "weeks", "weekUnit", "month", "months", "monthUnit", "oneTime"]) {
      const re = new RegExp(`\\b${field}:\\s*"([^"]*)"`);
      expect(templateLine.match(re)?.[1]).toBe(frontendLine.match(re)?.[1]);
    }
  });

  it("renders items through the shared billing line, not an inline template", () => {
    expect(template).toContain("billingLine(item, currency, locale)");
    // The old inline expression is what produced "1 month · €X/month".
    expect(template).not.toContain('(item.months === 1 ? "month" : "months")');
  });
});
