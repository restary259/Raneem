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
    if (inv.payment_status === "submitted") {
      return json(
        { error: "A bank transfer has already been submitted for this invoice. Please wait for DARB to confirm it." },
        409,
        corsHeaders,
      );
    }
    if (String(inv.currency).toUpperCase() !== "EUR") {
      return json({ error: "Card checkout is currently available only for EUR registration invoices" }, 409, corsHeaders);
    }

    const existingCard = Array.isArray(inv.payments)
      ? inv.payments.find((p: any) => p?.payment_method === "card" && p?.status === "pending")
      : null;
    const existingActive = Array.isArray(inv.payments)
      ? inv.payments.find((p: any) => ["pending", "submitted", "confirmed"].includes(p?.status))
      : null;

    if (existingActive && existingActive.payment_method !== "card") {
      return json(
        { error: "Another payment is already in progress for this invoice. Please use the payment method already selected." },
        409,
        corsHeaders,
      );
    }

    if (existingCard?.checkout_url) {
      return json({
        checkout_url: existingCard.checkout_url,
        payment_id: existingCard.id,
        invoice_url: `${SITE_URL}/invoice/${encodeURIComponent(token)}`
      }, 200, corsHeaders);
    }

    let payment = existingCard;
    let paymentError: { code?: string; message?: string } | null = null;

    if (!payment) {
      const inserted = await admin
        .from("case_registration_payments")
        .insert({
          invoice_id: inv.id,
          case_id: inv.case_id,
          payment_method: "card",
          amount: Number(inv.total_amount),
          currency: "EUR",
          status: "pending",
          reference: inv.case_reference,
        })
        .select("id,status,checkout_url,provider_payment_id")
        .single();

      payment = inserted.data;
      paymentError = inserted.error as { code?: string; message?: string } | null;

      if (paymentError?.code === "23505") {
        const { data: refreshedInvoice, error: refreshError } = await admin.rpc(
          "get_registration_invoice_by_token",
          { p_token: token },
        );
        if (refreshError || !refreshedInvoice) throw refreshError ?? new Error("Registration invoice not found");

        const refreshed = refreshedInvoice as Record<string, any>;
        if (refreshed.payment_status === "paid") {
          return json({
            paid: true,
            invoice_url: `${SITE_URL}/invoice/${encodeURIComponent(token)}`
          }, 200, corsHeaders);
        }

        const refreshedPayments = Array.isArray(refreshed.payments) ? refreshed.payments : [];
        const refreshedActive = refreshedPayments.find((p: any) =>
          ["pending", "submitted", "confirmed"].includes(p?.status)
        );

        if (!refreshedActive) throw paymentError;

        if (refreshedActive.payment_method !== "card") {
          return json(
            { error: "Another payment is already in progress for this invoice. Please use the payment method already selected." },
            409,
            corsHeaders,
          );
        }

        payment = refreshedActive;
        paymentError = null;
      }
    }

    if (paymentError) throw paymentError;
    if (!payment) throw new Error("Could not create or reuse card payment");

    const params = new URLSearchParams();
    params.set("mode", "payment");
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
