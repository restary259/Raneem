import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { isCronDispatcher } from "../_shared/cronAuth.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { serverErrorResponse } from "../_shared/errors.ts";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

type ClaimedRecipient = {
  id: string;
  campaign_id: string;
  conversation_id: string;
  template_id: string;
  attempt_count: number;
  max_attempts: number;
};

type TemplateRow = {
  id: string;
  provider_name: string;
  language_code: string;
  category: string;
  approval_status: string;
  is_active: boolean | null;
  components: unknown;
};

function templateBody(components: unknown) {
  if (!Array.isArray(components)) return "";
  const body = components.find((item) => {
    if (!item || typeof item !== "object") return false;
    return String((item as Record<string, unknown>).type ?? "").toUpperCase() === "BODY";
  }) as Record<string, unknown> | undefined;
  return String(body?.text ?? "");
}

function isRetryable(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

serve(async (req) => {
  const headers = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    const cron = await isCronDispatcher(req);
    if (!cron) {
      const auth = await requireAuth(req, ["admin"]);
      if (!auth.ok) return json({ error: auth.error }, auth.status, headers);
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    if (!serviceKey || !supabaseUrl) return json({ error: "Supabase service configuration is missing" }, 503, headers);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: recipients, error: claimError } = await admin.rpc("whatsapp_claim_due_marketing_recipients", { p_limit: 25 });
    if (claimError) throw claimError;

    let processed = 0;
    let sent = 0;
    let cancelled = 0;
    let failed = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const recipient of (recipients ?? []) as ClaimedRecipient[]) {
      processed += 1;
      try {
        const [{ data: campaign, error: campaignError }, { data: conversation, error: conversationError }] = await Promise.all([
          admin.from("whatsapp_campaigns").select("id,status,template_id").eq("id", recipient.campaign_id).maybeSingle(),
          admin.from("whatsapp_conversations").select("id,lead_id").eq("id", recipient.conversation_id).maybeSingle(),
        ]);
        if (campaignError) throw campaignError;
        if (conversationError) throw conversationError;

        if (!campaign || campaign.status === "cancelled" || campaign.status === "failed") {
          await admin.rpc("whatsapp_complete_marketing_recipient", {
            p_recipient_id: recipient.id,
            p_status: "cancelled",
            p_provider_message_id: null,
            p_error: "Campaign is no longer active",
          });
          cancelled += 1;
          results.push({ id: recipient.id, result: "cancelled", reason: "campaign_inactive" });
          continue;
        }

        if (!conversation?.lead_id) {
          await admin.rpc("whatsapp_complete_marketing_recipient", {
            p_recipient_id: recipient.id,
            p_status: "failed",
            p_provider_message_id: null,
            p_error: "Conversation has no WhatsApp lead",
          });
          failed += 1;
          results.push({ id: recipient.id, result: "failed", reason: "missing_lead" });
          continue;
        }

        const [{ data: lead, error: leadError }, { data: template, error: templateError }] = await Promise.all([
          admin.from("whatsapp_leads").select("id,whatsapp_number,marketing_consent_status").eq("id", conversation.lead_id).maybeSingle(),
          admin.from("whatsapp_templates").select("id,provider_name,language_code,category,approval_status,is_active,components").eq("id", recipient.template_id).maybeSingle(),
        ]);
        if (leadError) throw leadError;
        if (templateError) throw templateError;

        if (!lead || lead.marketing_consent_status !== "granted") {
          await admin.rpc("whatsapp_complete_marketing_recipient", {
            p_recipient_id: recipient.id,
            p_status: "cancelled",
            p_provider_message_id: null,
            p_error: "Marketing consent is no longer granted",
          });
          cancelled += 1;
          results.push({ id: recipient.id, result: "cancelled", reason: "consent_withdrawn" });
          continue;
        }

        const templateRow = template as TemplateRow | null;
        const body = templateRow ? templateBody(templateRow.components) : "";
        if (
          !templateRow ||
          templateRow.category !== "MARKETING" ||
          templateRow.approval_status !== "APPROVED" ||
          templateRow.is_active === false ||
          /\{\{\s*\d+\s*\}\}/.test(body)
        ) {
          await admin.rpc("whatsapp_complete_marketing_recipient", {
            p_recipient_id: recipient.id,
            p_status: "failed",
            p_provider_message_id: null,
            p_error: "Marketing template is unavailable or contains unsupported variables",
          });
          failed += 1;
          results.push({ id: recipient.id, result: "failed", reason: "template_invalid" });
          continue;
        }

        const response = await fetch(
          supabaseUrl + "/functions/v1/whatsapp-connector",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + serviceKey,
              "apikey": serviceKey,
              "Lovable-Context": "whatsapp-marketing-dispatch",
            },
            body: JSON.stringify({
              action: "send",
              conversation_id: recipient.conversation_id,
              template_id: recipient.template_id,
              campaign_recipient_id: recipient.id,
              parameters: [],
            }),
          },
        );

        const responseText = await response.text();
        let providerMessageId: string | null = null;
        try {
          const payload = JSON.parse(responseText) as {
            message?: { provider_message_id?: string | null };
            provider_message_id?: string | null;
            deduplicated?: boolean;
          };
          providerMessageId = payload.message?.provider_message_id ?? payload.provider_message_id ?? null;
        } catch {
          // Connector errors are handled below; successful responses normally
          // include the stored WhatsApp message envelope.
        }

        if (!response.ok) {
          const message = "WhatsApp connector returned " + response.status + ": " + responseText.slice(0, 500);
          if (isRetryable(response.status) && recipient.attempt_count < recipient.max_attempts) {
            await admin.rpc("whatsapp_complete_marketing_recipient", {
              p_recipient_id: recipient.id,
              p_status: "pending",
              p_provider_message_id: null,
              p_error: message,
            });
            failed += 1;
            results.push({ id: recipient.id, result: "retrying", reason: message });
          } else {
            await admin.rpc("whatsapp_complete_marketing_recipient", {
              p_recipient_id: recipient.id,
              p_status: "failed",
              p_provider_message_id: providerMessageId,
              p_error: message,
            });
            failed += 1;
            results.push({ id: recipient.id, result: "failed", reason: message });
          }
          continue;
        }

        await admin.rpc("whatsapp_complete_marketing_recipient", {
          p_recipient_id: recipient.id,
          p_status: "sent",
          p_provider_message_id: providerMessageId,
          p_error: null,
        });
        sent += 1;
        results.push({ id: recipient.id, result: "sent", provider_message_id: providerMessageId });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown marketing dispatch error";

        // The connector records the outbound message against the recipient before
        // final campaign bookkeeping. Recover either the recipient id or the
        // stored message so a post-provider crash never causes a duplicate send.
        const [{ data: currentRecipient }, { data: storedMessage }] = await Promise.all([
          admin
            .from("whatsapp_campaign_recipients")
            .select("provider_message_id")
            .eq("id", recipient.id)
            .maybeSingle(),
          admin
            .from("whatsapp_messages")
            .select("provider_message_id")
            .eq("campaign_recipient_id", recipient.id)
            .maybeSingle(),
        ]);

        const recoveredProviderId =
          currentRecipient?.provider_message_id ??
          storedMessage?.provider_message_id ??
          null;

        if (recoveredProviderId) {
          await admin.rpc("whatsapp_complete_marketing_recipient", {
            p_recipient_id: recipient.id,
            p_status: "sent",
            p_provider_message_id: recoveredProviderId,
            p_error: "Recovered after local bookkeeping error",
          }).catch(() => undefined);
          sent += 1;
          results.push({
            id: recipient.id,
            result: "recovered",
            provider_message_id: recoveredProviderId,
          });
          continue;
        }

        const terminal = recipient.attempt_count >= recipient.max_attempts;
        failed += 1;
        await admin.rpc("whatsapp_complete_marketing_recipient", {
          p_recipient_id: recipient.id,
          p_status: terminal ? "failed" : "pending",
          p_provider_message_id: null,
          p_error: message,
        }).catch(() => undefined);
        results.push({ id: recipient.id, result: terminal ? "failed" : "retrying", reason: message });
      }
    }

    return json({ processed, sent, cancelled, failed, results }, 200, headers);
  } catch (error) {
    return serverErrorResponse(error, headers, "WhatsApp marketing dispatch failed");
  }
});
