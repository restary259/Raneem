import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { serverErrorResponse } from "../_shared/errors.ts";

const GATEWAY = "https://connector-gateway.lovable.dev/whatsapp";
const PURPOSES = ["inquiry_follow_up", "consultation_confirmation", "document_reminder", "application_update"] as const;

type Purpose = typeof PURPOSES[number];
type ProviderTemplate = {
  name?: string;
  status?: string;
  language?: string;
  category?: string;
  components?: unknown[];
};

function json(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function digitsOnly(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function purposeForTemplate(name: string): Purpose | null {
  return PURPOSES.find((purpose) => name.includes(purpose)) ?? null;
}

function templateBody(components: unknown) {
  if (!Array.isArray(components)) return "";
  const body = components.find((item) => {
    if (!item || typeof item !== "object") return false;
    return String((item as Record<string, unknown>).type ?? "").toUpperCase() === "BODY";
  }) as Record<string, unknown> | undefined;
  return String(body?.text ?? "");
}

async function provider(path: string, method: string, body?: unknown) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const whatsappKey = Deno.env.get("WHATSAPP_API_KEY");
  if (!lovableKey || !whatsappKey) {
    return { ok: false, status: 503, text: "WhatsApp Business is not configured" };
  }
  const response = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": whatsappKey,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { ok: response.ok, status: response.status, text: await response.text() };
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await requireAuth(req, ["admin", "team_member"]);
    if (!auth.ok) return json({ error: auth.error }, auth.status, corsHeaders);
    if (!auth.userId) return json({ error: "A staff account is required" }, 403, corsHeaders);

    const input = await req.json();
    const action = String(input?.action ?? "");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (action === "sync_templates") {
      const upstream = await provider("/message_templates?fields=name,status,language,category,components&limit=100", "GET");
      if (!upstream.ok) return json({ error: "WhatsApp template sync failed", status: upstream.status, details: upstream.text.slice(0, 600) }, upstream.status, corsHeaders);
      const payload = JSON.parse(upstream.text || "{}") as { data?: ProviderTemplate[] };
      const rows = (payload.data ?? []).flatMap((template) => {
        const name = String(template.name ?? "");
        const purpose = purposeForTemplate(name);
        if (!purpose || !template.language) return [];
        return [{
          purpose,
          provider_name: name,
          language_code: template.language,
          category: String(template.category ?? "UTILITY").toUpperCase(),
          approval_status: String(template.status ?? "PENDING").toUpperCase(),
          components: template.components ?? [],
          last_synced_at: new Date().toISOString(),
        }];
      });
      if (rows.length) {
        const { error } = await admin.from("whatsapp_templates").upsert(rows, { onConflict: "provider_name,language_code" });
        if (error) throw error;
      }
      return json({ synced: rows.length }, 200, corsHeaders);
    }

    if (action === "create_template") {
      const purpose = String(input?.purpose ?? "") as Purpose;
      const language = input?.language === "ar" ? "ar" : "en_US";
      const category = input?.category === "MARKETING" ? "MARKETING" : "UTILITY";
      const body = String(input?.body ?? "").trim();
      if (!PURPOSES.includes(purpose) || body.length < 20 || body.length > 1024) {
        return json({ error: "Choose a supported purpose and enter a message between 20 and 1024 characters" }, 400, corsHeaders);
      }
      if (/{{\s*\d+\s*}}/.test(body)) {
        return json({ error: "Template variables require provider examples and are not supported in this form" }, 400, corsHeaders);
      }
      const name = `darb_${purpose}_${language.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      const upstream = await provider("/message_templates", "POST", {
        name,
        language,
        category,
        components: [{ type: "BODY", text: body }],
      });
      if (!upstream.ok) return json({ error: "WhatsApp rejected the template", status: upstream.status, details: upstream.text.slice(0, 600) }, upstream.status, corsHeaders);
      const { error } = await admin.from("whatsapp_templates").upsert({
        purpose,
        provider_name: name,
        language_code: language,
        category,
        approval_status: "PENDING",
        components: [{ type: "BODY", text: body }],
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "provider_name,language_code" });
      if (error) throw error;
      return json({ created: true, provider_name: name, approval_status: "PENDING" }, 200, corsHeaders);
    }

    if (action === "send") {
      const conversationId = String(input?.conversation_id ?? "");
      if (!conversationId) return json({ error: "Conversation is required" }, 400, corsHeaders);
      const { data: conversation, error } = await admin
        .from("whatsapp_conversations")
        .select("id, last_inbound_at, first_response_at, lead:whatsapp_leads!inner(whatsapp_number)")
        .eq("id", conversationId)
        .maybeSingle();
      if (error) throw error;
      if (!conversation) return json({ error: "Conversation not found" }, 404, corsHeaders);
      const lead = Array.isArray(conversation.lead) ? conversation.lead[0] : conversation.lead;
      const to = digitsOnly((lead as { whatsapp_number?: string } | null)?.whatsapp_number);
      if (to.length < 8 || to.length > 15) return json({ error: "The WhatsApp number is invalid" }, 400, corsHeaders);

      const lastInbound = conversation.last_inbound_at ? new Date(conversation.last_inbound_at).getTime() : Number.NaN;
      const insideWindow = Number.isFinite(lastInbound) && Date.now() >= lastInbound && Date.now() - lastInbound <= 24 * 60 * 60 * 1000;
      const templateId = input?.template_id ? String(input.template_id) : null;
      let providerBody: Record<string, unknown>;
      let storedBody = String(input?.body ?? "").trim();
      let messageType = "text";
      let templateName: string | null = null;

      if (templateId) {
        const { data: template, error: templateError } = await admin.from("whatsapp_templates").select("*").eq("id", templateId).maybeSingle();
        if (templateError) throw templateError;
        if (!template || template.approval_status !== "APPROVED") return json({ error: "Only an approved WhatsApp template can be sent" }, 400, corsHeaders);
        const parameters = Array.isArray(input?.parameters) ? input.parameters.map((value: unknown) => String(value).trim()) : [];
        const expected = [...templateBody(template.components).matchAll(/{{\s*(\d+)\s*}}/g)].length;
        if (parameters.length !== expected || parameters.some((value: string) => !value)) return json({ error: "Complete every template field before sending" }, 400, corsHeaders);
        const components = expected ? [{ type: "body", parameters: parameters.map((text: string) => ({ type: "text", text })) }] : [];
        providerBody = { messaging_product: "whatsapp", to, type: "template", template: { name: template.provider_name, language: { code: template.language_code }, components } };
        storedBody = templateBody(template.components) || template.provider_name;
        templateName = template.provider_name;
        messageType = "template";
      } else {
        if (!insideWindow) return json({ error: "An approved template is required outside the 24-hour service window" }, 409, corsHeaders);
        if (!storedBody || storedBody.length > 4096) return json({ error: "Enter a reply of up to 4096 characters" }, 400, corsHeaders);
        providerBody = { messaging_product: "whatsapp", to, type: "text", text: { body: storedBody } };
      }

      const upstream = await provider("/messages", "POST", providerBody);
      if (!upstream.ok) return json({ error: "WhatsApp could not send the message", status: upstream.status, details: upstream.text.slice(0, 600) }, upstream.status, corsHeaders);
      const payload = JSON.parse(upstream.text || "{}") as { messages?: { id?: string }[] };
      const providerMessageId = payload.messages?.[0]?.id ?? null;
      const now = new Date().toISOString();
      const { data: message, error: insertError } = await admin.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        provider_message_id: providerMessageId,
        direction: "outbound",
        message_type: messageType,
        body: storedBody,
        template_name: templateName,
        delivery_status: "accepted",
        authored_by: auth.userId,
        sent_at: now,
      }).select("*").single();
      if (insertError) throw insertError;
      const { error: updateError } = await admin.from("whatsapp_conversations").update({
        last_outbound_at: now,
        first_response_at: conversation.first_response_at ?? now,
        last_message_preview: storedBody.slice(0, 240),
        state: "open",
      }).eq("id", conversationId);
      if (updateError) throw updateError;
      return json({ message }, 200, corsHeaders);
    }

    return json({ error: "Unsupported action" }, 400, corsHeaders);
  } catch (error) {
    return serverErrorResponse(error, corsHeaders, "WhatsApp action failed");
  }
});