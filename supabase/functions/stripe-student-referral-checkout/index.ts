import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const SITE_URL = "https://darb.agency";

const json = (body: unknown, status = 200, headers: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

async function stripePost(path: string, params: URLSearchParams, secret: string, idempotencyKey?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers,
    body: params.toString(),
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "Stripe request failed";
    throw new Error(message);
  }
  return payload;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!stripeSecret) {
      return json({ error: "Card payment is not configured yet", code: "CARD_PAYMENT_NOT_CONFIGURED" }, 503, corsHeaders);
    }

    const body = await req.json();
    const token = String(body?.token ?? "").trim();
    if (!token) return json({ error: "Invoice token is required" }, 400, corsHeaders);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: invoice, error: invoiceError } = await admin.rpc(
      "get_registration_invoice_by_token",
      { p_token: token },
    );
    if (invoiceError || !invoice) return json({ error: "Registration invoice not found" }, 404, corsHeaders);

    const inv = invoice as Record<string, any>;
    if (inv.status === "cancelled") return json({ error: "This invoice is cancelled" }, 409, corsHeaders);
    if (inv.payment_status === "paid") return json({ paid: true, invoice_url: `${SITE_URL}/invoice/${encodeURIComponent(token)}` }, 200, corsHeaders);
    if (String(inv.currency).toUpperCase() !== "EUR") {
      return json({ error: "Card checkout is currently available only for EUR registration invoices" }, 409, corsHeaders);
    }

    const { data: paymentData, error: paymentError } = await admin.rpc(
      "create_registration_card_payment_internal",
      { p_invoice_id: inv.id },
    );
    if (paymentError) {
      const message = paymentError.message || "Could not create card payment";
      if (/another payment is already in progress/i.test(message)) {
        return json({ error: message }, 409, corsHeaders);
      }
      throw paymentError;
    }

    const paymentResult = paymentData as Record<string, any>;
    if (paymentResult?.paid) {
      return json({
        paid: true,
        invoice_url: `${SITE_URL}/invoice/${encodeURIComponent(token)}`
      }, 200, corsHeaders);
    }

    const payment = {
      id: paymentResult?.payment_id,
      status: paymentResult?.status,
      checkout_url: paymentResult?.checkout_url ?? null,
    };
    if (!payment.id) throw new Error("Could not create or reuse card payment");
    if (payment.checkout_url) {
      return json({
        checkout_url: payment.checkout_url,
        payment_id: payment.id,
        invoice_url: `${SITE_URL}/invoice/${encodeURIComponent(token)}`
      }, 200, corsHeaders);
    }

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("payment_method_types[]", "card");
    params.set("success_url", `${SITE_URL}/invoice/${encodeURIComponent(token)}?payment=success`);
    params.set("cancel_url", `${SITE_URL}/invoice/${encodeURIComponent(token)}?payment=cancelled`);
    params.set("customer_email", String(inv.student_email));
    params.set("client_reference_id", String(inv.case_reference ?? inv.case_id));
    params.set("metadata[invoice_id]", String(inv.id));
    params.set("metadata[payment_id]", String(payment.id));
    params.set("metadata[case_id]", String(inv.case_id));
    params.set("line_items[0][price_data][currency]", "eur");
    params.set("line_items[0][price_data][unit_amount]", String(Math.round(Number(inv.total_amount) * 100)));
    params.set("line_items[0][price_data][product_data][name]", `DARB registration ${inv.invoice_number}`);
    params.set("line_items[0][price_data][product_data][description]", `Case ${inv.case_reference ?? inv.case_id}`);
    params.set("line_items[0][quantity]", "1");

    let session: any;
    try {
      session = await stripePost(
        "checkout/sessions",
        params,
        stripeSecret,
        `darb-registration-checkout-${payment.id}`,
      );
    } catch (error) {
      await admin.from("case_registration_payments").update({
        status: "failed",
        failure_reason: error instanceof Error ? error.message : "Stripe checkout creation failed",
        updated_at: new Date().toISOString(),
      }).eq("id", payment.id).eq("status", "pending");
      throw error;
    }

    const { error: updateError } = await admin
      .from("case_registration_payments")
      .update({
        checkout_url: session.url,
        provider_payment_id: session.id,
        metadata: { stripe_checkout_session_id: session.id },
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (updateError) throw updateError;

    return json({
      checkout_url: session.url,
      payment_id: payment.id,
      invoice_url: `${SITE_URL}/invoice/${encodeURIComponent(token)}`,
    }, 200, corsHeaders);
  } catch (error) {
    console.error("[stripe-student-referral-checkout]", error);
    return json({ error: error instanceof Error ? error.message : "Could not start card payment" }, 500, corsHeaders);
  }
});
