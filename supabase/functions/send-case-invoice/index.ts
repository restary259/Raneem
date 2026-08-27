// Sends the DARB agency-service invoice email for one case.
//
// The recipient is never trusted from the caller: it must match the student
// email frozen on the invoice row, so a tampered client can never mail one
// student's financials to another address.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";
import { sendAppEmail } from "../_shared/send-app-email.ts";

const ALLOWED_ROLES = ["admin", "team_member"];

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
  let templateData: Record<string, unknown> = {};
  try {
    const body = await req.json();
    recipientEmail = String(body.recipientEmail ?? body.recipient_email ?? "");
    idempotencyKey = body.idempotencyKey ?? body.idempotency_key;
    if (body.templateData && typeof body.templateData === "object") {
      templateData = body.templateData;
    }
  } catch {
    return json({ error: "Invalid JSON in request body" }, 400);
  }

  const invoiceNumber = String(templateData.invoiceNumber ?? "");
  if (!invoiceNumber) return json({ error: "invoiceNumber is required" }, 400);
  if (!recipientEmail) return json({ error: "recipientEmail is required" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: invoiceRow, error: invoiceError } = await admin
    .from("case_invoices")
    .select("student_email")
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
    templateData,
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
