import { supabase } from "@/integrations/supabase/client";
import type { CaseFinancials } from "@/hooks/useCaseFinancials";

/**
 * Case invoices.
 *
 * The invoice is issued by the backend (`submit_case_for_review` →
 * `issue_case_invoice`) from `get_case_financials`, so the numbers on the
 * document are a server-side snapshot: the frontend never re-adds prices and a
 * later catalog change can never rewrite an issued invoice.
 */

export interface CaseInvoice {
  id: string;
  case_id: string;
  invoice_number: string;
  public_token: string;
  case_reference: string | null;
  student_name: string | null;
  student_email: string | null;
  totals: CaseFinancials;
  issued_at: string;
  email_status: "pending" | "sent" | "failed";
  email_error: string | null;
  email_sent_at: string | null;
}

export const invoiceUrl = (token: string) =>
  `${window.location.origin}/invoice/${token}`;

/** Submits the case to the admin and returns the invoice issued for it. */
export async function submitCaseForReview(caseId: string): Promise<CaseInvoice> {
  const { data, error } = await (supabase as any).rpc("submit_case_for_review", {
    p_case_id: caseId,
  });
  if (error) throw error;
  return data as CaseInvoice;
}

/** Re-issues the invoice for a case (admin or the assigned team member). */
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

/**
 * Sends the invoice to the student. Delivery is best-effort: a failure is
 * recorded on the invoice so an admin can see it and resend, and never rolls
 * back the submission itself.
 */
export async function sendInvoiceEmail(invoice: CaseInvoice): Promise<boolean> {
  if (!invoice.student_email) {
    await markInvoiceEmail(invoice.id, "failed", "no student email on file");
    return false;
  }
  try {
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "case-invoice",
        recipientEmail: invoice.student_email,
        idempotencyKey: `case-invoice-${invoice.invoice_number}`,
        templateData: {
          studentName: invoice.student_name,
          caseReference: invoice.case_reference,
          invoiceNumber: invoice.invoice_number,
          issuedAt: new Date(invoice.issued_at).toLocaleDateString("en-US"),
          serviceTotal: Number(invoice.totals?.service_total ?? 0).toLocaleString("en-US"),
          totalConfirmed: Number(invoice.totals?.total_confirmed ?? 0).toLocaleString("en-US"),
          remaining: Number(invoice.totals?.remaining ?? 0).toLocaleString("en-US"),
          link: invoiceUrl(invoice.public_token),
        },
      },
    });
    if (error) throw error;
    await markInvoiceEmail(invoice.id, "sent");
    return true;
  } catch (err) {
    await markInvoiceEmail(
      invoice.id,
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
