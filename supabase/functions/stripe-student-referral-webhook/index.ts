import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

function parseStripeSignature(value: string) {
  const parts = value.split(",").map((part) => part.split("="));
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  return { timestamp, signatures };
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
    if (!secret) return new Response("Webhook not configured", { status: 503 });

    const raw = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";
    const { timestamp, signatures } = parseStripeSignature(signature);
    if (!timestamp || signatures.length === 0) return new Response("Invalid signature", { status: 400 });

    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
      return new Response("Signature expired", { status: 400 });
    }

    const expected = await hmac(secret, `${timestamp}.${raw}`);
    if (!signatures.some((sig) => timingSafeEqual(sig, expected))) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(raw);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const object = event?.data?.object ?? {};
    const metadata = object?.metadata ?? {};
    const paymentId = String(metadata.payment_id ?? "");
    if (!paymentId) return new Response(JSON.stringify({ received: true, ignored: true }), { headers: { "Content-Type": "application/json" } });

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const providerId = String(object.payment_intent ?? object.id ?? "");
      const { error } = await admin.rpc("confirm_registration_card_payment_internal", {
        p_payment_id: paymentId,
        p_provider_payment_id: providerId,
      });
      if (error) {
        console.error("[stripe-student-referral-webhook] confirmation failed", error.message);
        return new Response("Payment confirmation failed", { status: 500 });
      }
    } else if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
      await admin
        .from("case_registration_payments")
        .update({
          status: "failed",
          failure_reason: event.type,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .eq("status", "pending");
      await admin
        .from("case_registration_invoices")
        .update({ payment_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", metadata.invoice_id ?? "");
    }

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[stripe-student-referral-webhook]", error);
    return new Response("Webhook error", { status: 500 });
  }
});
