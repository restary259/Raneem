// Sends the DARB agency-service invoice email for one case.
//
// The recipient is never trusted from the caller: it must match the student
// email frozen on the invoice row, so a tampered client can never mail one
// student's financials to another address.
//
// The rendered figures are likewise never trusted: the caller supplies only
// the invoice number, and every amount, line item, date and link in the email
// is rebuilt here from the frozen invoice row. A staff member therefore cannot
// email a student altered billing details.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";
import { sendAppEmail } from "../_shared/send-app-email.ts";

const ALLOWED_ROLES = ["admin", "team_member"];

// Invoice links live in emails, so they always point at production.
const INVOICE_SITE_URL = "https://darb.agency";

const money = (n: number) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const toFiniteNumber = (value: unknown, fallback: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

interface ServiceLine {
  description?: string;
  quantity?: number;
  unit_price?: number;
  discount?: number;
  line_total?: number;
}

/**
 * Rebuilds the email template data from the frozen invoice snapshot — the
 * same derivation the invoice page and PDF use (selectInvoiceTotals /
 * buildInvoiceEmailData), ported server-side so the caller's templateData is
 * never rendered.
 */
function buildServerTemplateData(invoice: {
  student_name: string | null;
  case_reference: string | null;
  invoice_number: string;
  issued_at: string;
  public_token: string;
  totals: unknown;
}) {
  const raw = (invoice.totals && typeof invoice.totals === "object"
    ? invoice.totals
    : {}) as Record<string, unknown>;
  const services = Array.isArray(raw.services) ? (raw.services as ServiceLine[]) : [];

  const subtotal = round2(
    services.reduce(
      (sum, s) => sum + toFiniteNumber(s?.unit_price, 0) * toFiniteNumber(s?.quantity, 0),
      0,
    ),
  );
  const discountTotal = round2(
    Math.max(services.reduce((sum, s) => sum + toFiniteNumber(s?.discount, 0), 0), 0),
  );
  const serviceTotal = toFiniteNumber(raw.service_total, round2(subtotal - discountTotal));
  const referralDiscount = Math.max(toFiniteNumber(raw.referral_discount, 0), 0);
  const totalConfirmed = toFiniteNumber(raw.total_confirmed, 0);
  const remaining = Math.max(round2(serviceTotal - totalConfirmed), 0);

  return {
    studentName: invoice.student_name ?? undefined,
    caseReference: invoice.case_reference ?? undefined,
    invoiceNumber: invoice.invoice_number,
    issuedAt: new Date(invoice.issued_at).toLocaleDateString("en-US"),
    currency: "ILS",
    services: services.map((s) => ({
      description: String(s?.description ?? ""),
      quantity: toFiniteNumber(s?.quantity, 0),
      unitPrice: money(toFiniteNumber(s?.unit_price, 0)),
      amount: money(
        toFiniteNumber(
          s?.line_total,
          round2(
            toFiniteNumber(s?.unit_price, 0) * toFiniteNumber(s?.quantity, 0) -
              toFiniteNumber(s?.discount, 0),
          ),
        ),
      ),
    })),
    subtotal: money(subtotal),
    discount: discountTotal > 0 ? money(discountTotal) : null,
    referralDiscount: referralDiscount > 0 ? money(referralDiscount) : null,
    serviceTotal: money(serviceTotal),
    totalConfirmed: totalConfirmed > 0 ? money(totalConfirmed) : null,
    remaining: money(remaining),
    link: `${INVOICE_SITE_URL}/invoice/${invoice.public_token}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const auth = await requireAuth(req, ALLOWED_ROLES);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  let recipientEmail = "";
  let idempotencyKey: string | undefined;
  let invoiceNumber = "";
  try {
    const body = await req.json();
    recipientEmail = String(body.recipientEmail ?? body.recipient_email ?? "");
    idempotencyKey = body.idempotencyKey ?? body.idempotency_key;
    // The invoice number is only a lookup key — every rendered field is
    // re-derived from the invoice row below.
    invoiceNumber = String(
      body.invoiceNumber ?? body.invoice_number ?? body.templateData?.invoiceNumber ?? "",
    );
  } catch {
    return json({ error: "Invalid JSON in request body" }, 400);
  }

  if (!invoiceNumber) return json({ error: "invoiceNumber is required" }, 400);
  if (!recipientEmail) return json({ error: "recipientEmail is required" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: invoiceRow, error: invoiceError } = await admin
    .from("case_invoices")
    .select("student_email, student_name, case_reference, invoice_number, issued_at, public_token, totals")
    .eq("invoice_number", invoiceNumber)
    .maybeSingle();

  if (invoiceError || !invoiceRow?.student_email) {
    return json({ error: "Invoice recipient could not be verified" }, invoiceError ? 500 : 404);
  }

  if (invoiceRow.student_email.toLowerCase() !== recipientEmail.toLowerCase()) {
    console.error("Invoice recipient mismatch — refusing to send", { invoiceNumber });
    return json({ error: "Recipient does not match the invoice's student email" }, 403);
  }

  const result = await sendAppEmail("case-invoice", invoiceRow.student_email, {
    templateData: buildServerTemplateData(invoiceRow),
    idempotencyKey: idempotencyKey ?? `case-invoice-${invoiceNumber}`,
  });

  if (!result.ok) {
    if (result.suppressed) {
      return json({ success: false, reason: "recipient_suppressed" });
    }
    return json({ error: result.detail ?? "Failed to send invoice email" }, 502);
  }

  return json({ success: true });
});
