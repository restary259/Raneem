import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { sendAppEmail } from "../_shared/send-app-email.ts";

const SITE_URL = "https://darb.agency";

const json = (body: unknown, status = 200, headers: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return json({ error: "Not authenticated" }, 401, corsHeaders);

    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData.user) return json({ error: "Not authenticated" }, 401, corsHeaders);

    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id).maybeSingle();
    const isStaff = roleRow?.role === "admin" || roleRow?.role === "team_member";
    if (!isStaff) return json({ error: "Not allowed" }, 403, corsHeaders);

    const body = await req.json();
    const invoiceId = String(body?.invoice_id ?? "").trim();
    if (!invoiceId) return json({ error: "invoice_id is required" }, 400, corsHeaders);

    const { data: invoice, error: invoiceError } = await admin
      .from("case_registration_invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invoiceError || !invoice) return json({ error: "Registration invoice not found" }, 404, corsHeaders);

    const { data: caseRow } = await admin.from("cases").select("assigned_to,case_reference").eq("id", invoice.case_id).maybeSingle();
    if (roleRow?.role === "team_member" && caseRow?.assigned_to !== userData.user.id) {
      return json({ error: "Not allowed for this case" }, 403, corsHeaders);
    }

    const { data: settings } = await admin
      .from("platform_settings")
      .select("registration_payment_bank_name,registration_payment_account_holder,registration_payment_iban,registration_payment_bic")
      .limit(1)
      .maybeSingle();

    const invoiceUrl = SITE_URL + "/invoice/" + encodeURIComponent(invoice.public_token);
    const result = await sendAppEmail(
      "student-registration-invoice",
      invoice.student_email,
      {
        // The idempotency key must be unique per send, otherwise a resend reuses
        // the first send's key and the mail service deduplicates it (the admin
        // sees "sent" but no new message is delivered).
        idempotencyKey: `student-registration-invoice-${invoice.invoice_number}-${Date.now()}`,
        templateData: {
          locale: invoice.locale,
          studentName: invoice.student_name,
          caseReference: invoice.case_reference ?? caseRow?.case_reference,
          invoiceNumber: invoice.invoice_number,
          issuedAt: invoice.issued_at,
          dueAt: invoice.due_at,
          referrerName: invoice.referrer_name,
          referralType: invoice.referral_type,
          currency: invoice.currency,
          subtotal: invoice.subtotal,
          total: invoice.total_amount,
          items: invoice.items,
          invoiceUrl,
          paymentStatus: invoice.payment_status,
          bankDetails: {
            bank_name: settings?.registration_payment_bank_name ?? "",
            account_holder: settings?.registration_payment_account_holder ?? "",
            iban: settings?.registration_payment_iban ?? "",
            bic: settings?.registration_payment_bic ?? "",
          },
        },
      },
    );

    await admin.from("case_registration_invoices").update({
      email_status: result.ok ? "sent" : "failed",
      email_error: result.ok ? null : result.detail ?? "Email send failed",
      email_sent_at: result.ok ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", invoice.id);

    if (!result.ok) return json({ error: result.detail ?? "Could not send invoice" }, 502, corsHeaders);
    return json({ ok: true, invoice_url: invoiceUrl }, 200, corsHeaders);
  } catch (error) {
    console.error("[send-student-registration-invoice]", error);
    return json({ error: error instanceof Error ? error.message : "Could not send invoice" }, 500, corsHeaders);
  }
});
