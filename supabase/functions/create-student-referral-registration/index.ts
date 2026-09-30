import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { sendAppEmail } from "../_shared/send-app-email.ts";

const SITE_URL = "https://darb.agency";

const json = (body: unknown, status = 200, headers: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) return json({ error: "Server configuration is incomplete" }, 500, corsHeaders);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return json({ error: "Not authenticated" }, 401, corsHeaders);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData.user) return json({ error: "Not authenticated" }, 401, corsHeaders);

    const userId = userData.user.id;
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleRow?.role !== "student") {
      return json({ error: "Only students can create referral registrations" }, 403, corsHeaders);
    }

    const body = await req.json();
    if (!body || typeof body !== "object") return json({ error: "Invalid payload" }, 400, corsHeaders);

    const payload = {
      ...body,
      locale: ["ar", "he", "en"].includes(body.locale) ? body.locale : "en",
    };

    const { data, error } = await admin.rpc("create_student_referral_registration_internal", {
      p_referrer_user_id: userId,
      p_data: payload,
    });

    if (error) {
      console.error("[create-student-referral-registration]", error.message);
      return json({ error: error.message }, 400, corsHeaders);
    }

    const registration = data as Record<string, unknown>;
    const invoiceToken = String(registration.public_token ?? "");
    const invoiceUrl = invoiceToken ? `${SITE_URL}/invoice/${encodeURIComponent(invoiceToken)}` : null;

    // Re-read through the server-only service role so email data is generated
    // from the stored financial snapshot, never from client-submitted totals.
    const { data: invoiceData, error: invoiceError } = await admin.rpc(
      "get_registration_invoice_by_token",
      { p_token: invoiceToken },
    );

    if (invoiceError || !invoiceData) {
      console.error("[create-student-referral-registration] invoice read failed", invoiceError?.message);
      return json({
        ...registration,
        invoice_url: invoiceUrl,
        email_status: "failed",
      }, 200, corsHeaders);
    }

    const invoice = invoiceData as Record<string, any>;
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const locale = String(invoice.locale ?? registration.locale ?? "en");

    const emailResult = await sendAppEmail(
      "student-registration-invoice",
      String(invoice.student_email ?? registration.student_email ?? ""),
      {
        idempotencyKey: `student-registration-invoice-${invoice.invoice_number}`,
        templateData: {
          locale,
          studentName: invoice.student_name,
          caseReference: invoice.case_reference,
          invoiceNumber: invoice.invoice_number,
          issuedAt: invoice.issued_at,
          referrerName: invoice.referrer_name,
          referralType: invoice.referral_type,
          currency: invoice.currency,
          subtotal: invoice.subtotal,
          total: invoice.total_amount,
          dueAt: invoice.due_at,
          items,
          invoiceUrl,
          paymentStatus: invoice.payment_status,
          bankDetails: invoice.bank_details,
        },
      },
    );

    await admin
      .from("case_registration_invoices")
      .update({
        email_status: emailResult.ok ? "sent" : "failed",
        email_error: emailResult.ok ? null : emailResult.detail ?? "Email send failed",
        email_sent_at: emailResult.ok ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    return json({
      ...registration,
      invoice_url: invoiceUrl,
      email_status: emailResult.ok ? "sent" : "failed",
      email_suppressed: emailResult.suppressed ?? false,
    }, 200, corsHeaders);
  } catch (error) {
    console.error("[create-student-referral-registration] unexpected error", error);
    return json({ error: error instanceof Error ? error.message : "Registration failed" }, 500, corsHeaders);
  }
});
