/* eslint-disable @typescript-eslint/no-explicit-any -- loose types for untyped mock surfaces (supabase query builders, browser globals) */
import { beforeEach, describe, expect, it, vi } from "vitest";

type RpcResult = { data: unknown; error: { message: string } | null };
let rpcResult: RpcResult = { data: null, error: null };
let rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = [];
let invoiceRow: unknown = null;
let invoiceError: { message: string } | null = null;
let invokeResult: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
};
let invokeCalls: Array<{ name: string; options: any }> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "case_invoices")
        throw new Error(`unexpected from(${table})`);
      const result = { data: invoiceRow, error: invoiceError };
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => Promise.resolve(result),
      };
      return chain;
    },
    rpc: (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResult);
    },
    functions: {
      invoke: (name: string, options: any) => {
        invokeCalls.push({ name, options });
        return Promise.resolve(invokeResult);
      },
    },
  },
}));

import {
  buildInvoiceEmailData,
  getCaseInvoice,
  invoiceUrl,
  issueCaseInvoice,
  markInvoiceEmail,
  sendInvoiceEmail,
  submitCaseForReview,
  type CaseInvoice,
} from "./CaseInvoiceService";

const invoice = (overrides: Partial<CaseInvoice> = {}): CaseInvoice => ({
  id: "inv1",
  case_id: "c1",
  invoice_number: "INV-100",
  public_token: "tok-abc",
  case_reference: "REF-1",
  student_name: "Layla",
  student_email: "layla@example.com",
  totals: {
    currency: "ILS",
    services: [
      {
        id: "s1",
        description: "Agency service",
        category: "service",
        quantity: 2,
        unit_price: 500,
        discount: 100,
        currency: "ILS",
        line_total: 900,
      },
    ],
    service_total: 900,
    referral_discount: 50,
    payment_type: "agency_service",
  },
  issued_at: "2026-03-01T10:00:00Z",
  email_status: "pending",
  email_error: null,
  email_sent_at: null,
  ...overrides,
});

beforeEach(() => {
  rpcResult = { data: null, error: null };
  rpcCalls = [];
  invoiceRow = null;
  invoiceError = null;
  invokeResult = { data: null, error: null };
  invokeCalls = [];
});

describe("invoiceUrl", () => {
  it("always points at the production site", () => {
    expect(invoiceUrl("abc")).toBe("https://darb.agency/invoice/abc");
  });
});

describe("submitCaseForReview / issueCaseInvoice", () => {
  it("submitCaseForReview forwards the case id", async () => {
    rpcResult = { data: invoice(), error: null };
    await expect(submitCaseForReview("c1")).resolves.toMatchObject({
      id: "inv1",
    });
    expect(rpcCalls[0]).toEqual({
      fn: "submit_case_for_review",
      args: { p_case_id: "c1" },
    });
  });

  it("issueCaseInvoice forwards the case id", async () => {
    rpcResult = { data: invoice(), error: null };
    await expect(issueCaseInvoice("c1")).resolves.toMatchObject({ id: "inv1" });
    expect(rpcCalls[0]).toEqual({
      fn: "issue_case_invoice",
      args: { p_case_id: "c1" },
    });
  });

  it("propagates RPC errors", async () => {
    rpcResult = { data: null, error: { message: "denied" } };
    await expect(issueCaseInvoice("c1")).rejects.toEqual({ message: "denied" });
  });
});

describe("getCaseInvoice", () => {
  it("returns the row", async () => {
    invoiceRow = invoice();
    await expect(getCaseInvoice("c1")).resolves.toMatchObject({ id: "inv1" });
  });

  it("returns null when there is no row", async () => {
    invoiceRow = null;
    await expect(getCaseInvoice("c1")).resolves.toBeNull();
  });

  it("throws the query error", async () => {
    invoiceError = { message: "boom" };
    await expect(getCaseInvoice("c1")).rejects.toEqual({ message: "boom" });
  });
});

describe("buildInvoiceEmailData", () => {
  it("derives every figure from selectInvoiceTotals and formats money", () => {
    const data = buildInvoiceEmailData(invoice());
    expect(data).toMatchObject({
      studentName: "Layla",
      caseReference: "REF-1",
      invoiceNumber: "INV-100",
      currency: "ILS",
      link: "https://darb.agency/invoice/tok-abc",
      subtotal: "1,000.00",
      discount: "100.00",
      referralDiscount: "50.00",
      serviceTotal: "900.00",
      remaining: "900.00",
    });
    expect(data.services).toEqual([
      {
        description: "Agency service",
        quantity: 2,
        unitPrice: "500.00",
        amount: "900.00",
      },
    ]);
    expect(data.issuedAt).toBe(
      new Date("2026-03-01T10:00:00Z").toLocaleDateString("en-US"),
    );
  });

  it("omits discount fields that are zero instead of fabricating them", () => {
    const data = buildInvoiceEmailData(
      invoice({
        totals: {
          currency: "ILS",
          services: [
            {
              id: "s1",
              description: "Service",
              category: "service",
              quantity: 1,
              unit_price: 300,
              discount: 0,
              currency: "ILS",
              line_total: 300,
            },
          ],
          service_total: 300,
          payment_type: "agency_service",
        },
      }),
    );
    expect(data.discount).toBeNull();
    expect(data.referralDiscount).toBeNull();
    expect(data.totalConfirmed).toBeNull();
  });

  it("shows the confirmed total when payments exist", () => {
    const data = buildInvoiceEmailData(
      invoice({
        totals: {
          currency: "ILS",
          services: [
            {
              id: "s1",
              description: "Service",
              category: "service",
              quantity: 1,
              unit_price: 300,
              discount: 0,
              currency: "ILS",
              line_total: 300,
            },
          ],
          service_total: 300,
          total_confirmed: 100,
          payment_type: "agency_service",
        } as never,
      }),
    );
    expect(data.totalConfirmed).toBe("100.00");
    expect(data.remaining).toBe("200.00");
  });
});

describe("markInvoiceEmail", () => {
  it("forwards status and error", async () => {
    await markInvoiceEmail("inv1", "failed", "no email");
    expect(rpcCalls[0]).toEqual({
      fn: "mark_invoice_email",
      args: { p_invoice_id: "inv1", p_status: "failed", p_error: "no email" },
    });
  });

  it("defaults the error to null", async () => {
    await markInvoiceEmail("inv1", "sent");
    expect(rpcCalls[0].args).toEqual({
      p_invoice_id: "inv1",
      p_status: "sent",
      p_error: null,
    });
  });
});

describe("sendInvoiceEmail", () => {
  it("re-issues, invokes the sender and marks the invoice sent", async () => {
    rpcResult = { data: invoice(), error: null };
    invokeResult = { data: { ok: true }, error: null };

    await expect(sendInvoiceEmail(invoice())).resolves.toBe(true);

    expect(rpcCalls[0].fn).toBe("issue_case_invoice");
    expect(invokeCalls[0].name).toBe("send-case-invoice");
    expect(invokeCalls[0].options.body.recipientEmail).toBe(
      "layla@example.com",
    );
    expect(invokeCalls[0].options.body.idempotencyKey).toBe(
      "case-invoice-INV-100-2026-03-01T10:00:00Z",
    );
    const mark = rpcCalls.find((c) => c.fn === "mark_invoice_email");
    expect(mark?.args).toMatchObject({
      p_invoice_id: "inv1",
      p_status: "sent",
    });
  });

  it("marks failed when re-issuing throws", async () => {
    rpcResult = { data: null, error: new Error("issue failed") as never };
    await expect(sendInvoiceEmail(invoice())).resolves.toBe(false);
    const mark = rpcCalls.find((c) => c.fn === "mark_invoice_email");
    expect(mark?.args).toMatchObject({
      p_status: "failed",
      p_error: "issue failed",
    });
    expect(invokeCalls).toHaveLength(0);
  });

  it("marks failed when the invoice has no student email", async () => {
    rpcResult = { data: invoice({ student_email: null }), error: null };
    await expect(sendInvoiceEmail(invoice())).resolves.toBe(false);
    const mark = rpcCalls.find((c) => c.fn === "mark_invoice_email");
    expect(mark?.args).toMatchObject({
      p_status: "failed",
      p_error: "no student email on file",
    });
  });

  it("marks failed when there are no invoiceable services", async () => {
    rpcResult = {
      data: invoice({
        totals: {
          currency: "ILS",
          services: [],
          service_total: 0,
          payment_type: "agency_service",
        },
      }),
      error: null,
    };
    await expect(sendInvoiceEmail(invoice())).resolves.toBe(false);
    const mark = rpcCalls.find((c) => c.fn === "mark_invoice_email");
    expect(mark?.args).toMatchObject({
      p_status: "failed",
      p_error: "no invoiceable services on this case",
    });
  });

  it("marks failed with the provider message when the invoke fails", async () => {
    rpcResult = { data: invoice(), error: null };
    invokeResult = { data: null, error: new Error("smtp down") as never };
    await expect(sendInvoiceEmail(invoice())).resolves.toBe(false);
    const marks = rpcCalls.filter((c) => c.fn === "mark_invoice_email");
    expect(marks.at(-1)?.args).toMatchObject({
      p_status: "failed",
      p_error: "smtp down",
    });
  });
});
