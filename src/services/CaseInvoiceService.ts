import { supabase } from "@/integrations/supabase/client";
import { selectInvoiceTotals } from "@/utils/invoiceTotals";

/**
 * DARB agency-service invoice.
 *
 * The backend (`submit_case_for_review` → `issue_case_invoice`) creates the
 * invoice from the frozen case_services snapshot. Germany school costs are
 * estimates and are intentionally excluded from this invoice.
 */
export interface CaseInvoice {

  id: string;
  case_id: string;
  invoice_number: string;
  public_token: string;
  case_reference: string | null;
  student_name: string | null;
  student_email: string | null;
  totals: {
    currency: "ILS";
    services: Array<{
      id: string;
      description: string;
      category: string;
      quantity: number;
      unit_price: number;
      discount: number;
      currency: string;
      line_total: number;
    }>;
    service_total: number;
    referral_discount?: number;
    payment_type: "agency_service";
  };
  issued_at: string;
  email_status: "pending" | "sent" | "failed";
  email_error: string | null;
  email_sent_at: string | null;
}

/**
 * Invoice links live in emails, so they must always point at production —
 * never at whatever origin the staff member happened to send from (preview
 * URLs are not reachable by students).
 */
const INVOICE_SITE_URL = "https://darb.agency";

export const invoiceUrl = (token: string) => `${INVOICE_SITE_URL}/invoice/${token}`;

/** Submits the case to Admin and returns the DARB-only invoice. */
export async function submitCaseForReview(caseId: string): Promise<CaseInvoice> {
  const { data, error } = await (supabase as any).rpc("submit_case_for_review", {
    p_case_id: caseId,
  });
  if (error) throw error;
  return data as CaseInvoice;
}

/** Re-issues the DARB-only invoice for a case. */
export async function issueCaseInvoice(caseId: string): Promise<CaseInvoice> {
  const { data, error } = await (supabase as any).rpc("issue_case_invoice", {
    p_case_id: caseId,
  });
  if (error) throw error;
  return data as CaseInvoice;
}

export async function getCaseInvoice(caseId: string): Promise<CaseInvoice | null> {
  const { data, error } = await (supabase as any)
    .from("case_invoices")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();
  if (error) throw error;
  return (data as CaseInvoice) ?? null;
}

const money = (n: number) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Maps the frozen invoice snapshot into the props the branded email template
 * renders. Every number comes from `selectInvoiceTotals` — the same derivation
 * the invoice page and the PDF use — so the three surfaces can never disagree.
 * Fields with no data (no discount, nothing paid) are omitted rather than
 * fabricated.
 */
export function buildInvoiceEmailData(invoice: CaseInvoice) {
  const t = selectInvoiceTotals(invoice.totals);

  return {
    studentName: invoice.student_name,
    caseReference: invoice.case_reference,
    invoiceNumber: invoice.invoice_number,
    issuedAt: new Date(invoice.issued_at).toLocaleDateString("en-US"),
    currency: "ILS",
    services: t.services.map((s) => ({
      description: s.description,
      quantity: s.quantity,
      unitPrice: money(s.unit_price),
      amount: money(s.line_total),
    })),
    subtotal: money(t.subtotal),
    discount: t.discount_total > 0 ? money(t.discount_total) : null,
    referralDiscount: t.referral_discount > 0 ? money(t.referral_discount) : null,
    serviceTotal: money(t.service_total),
    totalConfirmed: t.total_confirmed > 0 ? money(t.total_confirmed) : null,
    remaining: money(t.remaining),
    schoolCosts: t.school_costs.map((l) => ({
      label: l.name_en || l.name_ar || l.kind,
      amount: money(l.total),
      currency: l.currency || "EUR",
    })),
    link: invoiceUrl(invoice.public_token),
  };
}

/**
 * Sends only the DARB agency-service invoice. Germany payment verification is
 * a separate Admin workflow and is never included in this email's amounts.
 *
 * The invoice is re-issued first (idempotent — same number, same public token)
 * so the Paid / Remaining figures always reflect the currently confirmed
 * payments instead of a stale snapshot. The recipient is never taken from the
 * caller: it is whatever the server froze on the invoice row, and the edge
 * function re-validates it.
 */
export async function sendInvoiceEmail(invoice: CaseInvoice): Promise<boolean> {
  let fresh = invoice;
  try {
    fresh = await issueCaseInvoice(invoice.case_id);
  } catch (err) {
    await markInvoiceEmail(
      invoice.id,
      "failed",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }

  if (!fresh.student_email) {
    await markInvoiceEmail(fresh.id, "failed", "no student email on file");
    return false;
  }

  const data = buildInvoiceEmailData(fresh);
  if (data.services.length === 0) {
    await markInvoiceEmail(fresh.id, "failed", "no invoiceable services on this case");
    return false;
  }

  try {
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "case-invoice",
        recipientEmail: fresh.student_email,
        idempotencyKey: `case-invoice-${fresh.invoice_number}-${fresh.issued_at}`,
        templateData: data,
      },
    });
    if (error) throw error;
    await markInvoiceEmail(fresh.id, "sent");
    return true;
  } catch (err) {
    await markInvoiceEmail(
      fresh.id,
      "failed",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}


export async function markInvoiceEmail(
  invoiceId: string,
  status: "pending" | "sent" | "failed",
  error?: string,
) {
  await (supabase as any).rpc("mark_invoice_email", {
    p_invoice_id: invoiceId,
    p_status: status,
    p_error: error ?? null,
  });
}
