import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { serverErrorResponse } from "../_shared/errors.ts";

const GATEWAY = "https://connector-gateway.lovable.dev/whatsapp";
const PURPOSES = [
  "lead_received",
  "lead_followup",
  "inquiry_follow_up",
  "appointment_invitation",
  "appointment_confirmation",
  "consultation_confirmation",
  "appointment_reminder",
  "documents_missing",
  "document_reminder",
  "profile_incomplete",
  "document_received",
  "payment_instruction",
  "payment_reminder",
  "payment_confirmed",
  "application_started",
  "application_submitted",
  "application_update",
  "student_welcome",
  "enrollment_confirmation",
  "next_steps",
  "support_followup",
  "case_update",
] as const;
const MEDIA_TYPES = ["image", "video", "audio", "document"];

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

function normalizeWhatsAppNumber(value: unknown) {
  const digits = digitsOnly(value);
  if (/^05\d{8}$/.test(digits)) return `972${digits.slice(1)}`;
  if (/^00972\d{9}$/.test(digits)) return digits.slice(2);
  if (/^972\d{9}$/.test(digits)) return digits;
  if (digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0")) return digits;
  return null;
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

/**
 * Best-effort compatibility bridge while the final migration set is still
 * staged. Once the identity-bridge migration is applied, every staff-started
 * conversation is resolved against the existing DARB graph before it is
 * returned to the UI. Before that migration exists, the old start flow keeps
 * working instead of failing on an undefined RPC.
 */
async function resolveDarbIdentity(admin: ReturnType<typeof createClient>, whatsappLeadId: string) {
  const first = await admin.rpc("whatsapp_auto_resolve_identity", {
    p_whatsapp_lead_id: whatsappLeadId,
  });

  if (first.error) {
    // SQLSTATE 42883 = undefined_function. This is expected only while the
    // identity-bridge migration is intentionally not yet applied.
    if ((first.error as { code?: string }).code === "42883") return null;
    throw first.error;
  }

  const resolution = (first.data ?? null) as { status?: string } | null;
  if (resolution?.status !== "unknown") return resolution;

  const second = await admin.rpc("whatsapp_ensure_core_lead", {
    p_whatsapp_lead_id: whatsappLeadId,
  });
  if (second.error) {
    if ((second.error as { code?: string }).code === "42883") return resolution;
    throw second.error;
  }
  return second.data as { status?: string } | null;
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
    if (!auth.userId && !auth.isServiceRole) return json({ error: "A staff account is required" }, 403, corsHeaders);

    const input = await req.json();
    const action = String(input?.action ?? "");
    // Template management (sync, create, activate, release to team) is an
    // admin-only capability. Team members may only send approved templates.
    const isAdmin = auth.isServiceRole === true || (auth.roles ?? []).includes("admin");
    if (["sync_templates", "create_template", "set_template_flags"].includes(action) && !isAdmin) {
      return json({ error: "Only an administrator can manage WhatsApp templates" }, 403, corsHeaders);
    }

    // Team members may use the shared WhatsApp connector only when an admin
    // explicitly enabled the shared inbox for their profile. Service-role
    // automation and administrators are unaffected.
    if (!isAdmin && auth.userId) {
      const { data: profile, error: accessError } = await admin
        .from("profiles")
        .select("whatsapp_inbox_enabled")
        .eq("id", auth.userId)
        .maybeSingle();
      if (accessError) throw accessError;
      if (!profile?.whatsapp_inbox_enabled) {
        return json(
          { error: "Shared WhatsApp inbox access is not enabled for this team member" },
          403,
          corsHeaders,
        );
      }
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (action === "start_conversation") {
      const whatsappNumber = normalizeWhatsAppNumber(input?.whatsapp_number);
      const studentName = String(input?.student_name ?? "").trim().slice(0, 200);
      const requestedCaseId = input?.case_id ? String(input.case_id) : null;
      const requestedLeadId = input?.lead_id ? String(input.lead_id) : null;
      const requestedProfileId = input?.profile_id ? String(input.profile_id) : null;
      if (!whatsappNumber) return json({ error: "Enter a valid WhatsApp number with its country code" }, 400, corsHeaders);
      if (requestedCaseId || requestedLeadId || requestedProfileId) {
        const [caseResult, leadResult, profileResult] = await Promise.all([
          requestedCaseId
            ? admin.from("cases").select("id,full_name,phone_number,student_user_id").eq("id", requestedCaseId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          requestedLeadId
            ? admin.from("leads").select("id,full_name,phone").eq("id", requestedLeadId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          requestedProfileId
            ? admin.from("profiles").select("id,full_name,phone_number,case_id,linked_case_id").eq("id", requestedProfileId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (caseResult.error) throw caseResult.error;
        if (leadResult.error) throw leadResult.error;
        if (profileResult.error) throw profileResult.error;

        if (requestedCaseId && (!caseResult.data || normalizeWhatsAppNumber(caseResult.data.phone_number) !== whatsappNumber)) {
          return json({ error: "The selected case does not match the WhatsApp number" }, 409, corsHeaders);
        }
        if (requestedLeadId && (!leadResult.data || normalizeWhatsAppNumber(leadResult.data.phone) !== whatsappNumber)) {
          return json({ error: "The selected lead does not match the WhatsApp number" }, 409, corsHeaders);
        }
        if (requestedProfileId && (!profileResult.data || normalizeWhatsAppNumber(profileResult.data.phone_number) !== whatsappNumber)) {
          return json({ error: "The selected student account does not match the WhatsApp number" }, 409, corsHeaders);
        }
      }

      const { data: existingLead, error: existingError } = await admin
        .from("whatsapp_leads")
        .select("*")
        .eq("whatsapp_number", whatsappNumber)
        .maybeSingle();
      if (existingError) throw existingError;

      let lead = existingLead;
      let created = false;
      if (!lead) {
        const { data: insertedLead, error: leadError } = await admin.from("whatsapp_leads").insert({
          whatsapp_number: whatsappNumber,
          student_name: studentName,
          source: "whatsapp",
          consent_status: "unknown",
          lead_stage: "new",
          created_by: auth.userId,
          linked_case_id: requestedCaseId,
          linked_lead_id: requestedLeadId,
          linked_profile_id: requestedProfileId,
          identity_confirmed_by: requestedCaseId || requestedLeadId || requestedProfileId ? auth.userId : null,
          identity_confirmed_at: requestedCaseId || requestedLeadId || requestedProfileId ? new Date().toISOString() : null,
        }).select("*").single();
        if (leadError) {
          if (leadError.code !== "23505") throw leadError;
          const { data: racedLead, error: racedError } = await admin.from("whatsapp_leads").select("*").eq("whatsapp_number", whatsappNumber).single();
          if (racedError) throw racedError;
          lead = racedLead;
        } else {
          lead = insertedLead;
          created = true;
        }
      }
      if (!lead) return json({ error: "WhatsApp lead could not be created" }, 500, corsHeaders);

      // Reuse the same identity bridge for staff-started conversations. This
      // means "new conversation" does not silently create a second DARB person
      // when the number already belongs to a lead, case or student account.
      if (!requestedCaseId && !requestedLeadId && !requestedProfileId) {
        await resolveDarbIdentity(admin, lead.id);
        const { data: refreshedLead, error: refreshError } = await admin
          .from("whatsapp_leads")
          .select("*")
          .eq("id", lead.id)
          .single();
        if (refreshError) throw refreshError;
        lead = refreshedLead;
      }

      if (requestedCaseId || requestedLeadId || requestedProfileId) {
        const conflicts =
          (requestedCaseId && lead.linked_case_id && lead.linked_case_id !== requestedCaseId) ||
          (requestedLeadId && lead.linked_lead_id && lead.linked_lead_id !== requestedLeadId) ||
          (requestedProfileId && lead.linked_profile_id && lead.linked_profile_id !== requestedProfileId);
        if (conflicts) return json({ error: "This WhatsApp contact is already linked to a different DARB record" }, 409, corsHeaders);

        const resolvedName =
          studentName ||
          (requestedCaseId ? String((await admin.from("cases").select("full_name").eq("id", requestedCaseId).maybeSingle()).data?.full_name ?? "") : "") ||
          (requestedProfileId ? String((await admin.from("profiles").select("full_name").eq("id", requestedProfileId).maybeSingle()).data?.full_name ?? "") : "") ||
          (requestedLeadId ? String((await admin.from("leads").select("full_name").eq("id", requestedLeadId).maybeSingle()).data?.full_name ?? "") : "");

        const { data: linkedLead, error: linkError } = await admin.from("whatsapp_leads").update({
          linked_case_id: requestedCaseId ?? lead.linked_case_id,
          linked_lead_id: requestedLeadId ?? lead.linked_lead_id,
          linked_profile_id: requestedProfileId ?? lead.linked_profile_id,
          identity_confirmed_by: auth.userId,
          identity_confirmed_at: new Date().toISOString(),
          ...(resolvedName && !lead.student_name ? { student_name: resolvedName } : {}),
          updated_at: new Date().toISOString(),
        }).eq("id", lead.id).select("*").single();
        if (linkError) throw linkError;
        lead = linkedLead;
      }

      const { data: existingConversation, error: conversationReadError } = await admin.from("whatsapp_conversations").select("*").eq("lead_id", lead.id).maybeSingle();
      if (conversationReadError) throw conversationReadError;
      let conversation = existingConversation;
      if (!conversation) {
        const { data: insertedConversation, error: conversationError } = await admin.from("whatsapp_conversations").insert({
          lead_id: lead.id,
          state: "new",
          human_takeover: true,
          takeover_by: auth.userId,
          takeover_at: new Date().toISOString(),
        }).select("*").single();
        if (conversationError) {
          if (conversationError.code !== "23505") throw conversationError;
          const { data: racedConversation, error: racedConversationError } = await admin.from("whatsapp_conversations").select("*").eq("lead_id", lead.id).single();
          if (racedConversationError) throw racedConversationError;
          conversation = racedConversation;
        } else conversation = insertedConversation;
      }
      if (!isAdmin && auth.userId && conversation.assigned_to == null) {
        const { data: assignedConversation, error: assignError } = await admin
          .from("whatsapp_conversations")
          .update({ assigned_to: auth.userId, updated_at: new Date().toISOString() })
          .eq("id", conversation.id)
          .is("assigned_to", null)
          .select("*")
          .maybeSingle();
        if (assignError) throw assignError;
        if (assignedConversation) conversation = assignedConversation;
      }

      return json({ created, lead, conversation }, 200, corsHeaders);
    }

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
      const language = input?.language === "ar" ? "ar" : input?.language === "he" ? "he" : "en_US";
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

    if (action === "set_template_flags") {
      const templateId = String(input?.template_id ?? "");
      if (!templateId) return json({ error: "Template is required" }, 400, corsHeaders);
      const patch: Record<string, boolean> = {};
      if (typeof input?.is_active === "boolean") patch.is_active = input.is_active;
      if (typeof input?.available_to_team === "boolean") patch.available_to_team = input.available_to_team;
      if (!Object.keys(patch).length) return json({ error: "Nothing to update" }, 400, corsHeaders);
      const { data: updated, error } = await admin.from("whatsapp_templates").update(patch).eq("id", templateId).select("*").maybeSingle();
      if (error) throw error;
      if (!updated) return json({ error: "Template not found" }, 404, corsHeaders);
      return json({ template: updated }, 200, corsHeaders);
    }

    if (action === "send") {
      const conversationId = String(input?.conversation_id ?? "");
      if (!conversationId) return json({ error: "Conversation is required" }, 400, corsHeaders);
      const campaignRecipientId = input?.campaign_recipient_id ? String(input.campaign_recipient_id) : null;
      const followUpTaskId = input?.follow_up_task_id ? String(input.follow_up_task_id) : null;
      const templateId = input?.template_id ? String(input.template_id) : null;
      if (campaignRecipientId && followUpTaskId) {
        return json({ error: "Campaign and follow-up idempotency keys cannot be combined" }, 400, corsHeaders);
      }
      const { data: conversation, error } = await admin
        .from("whatsapp_conversations")
        .select("id, last_inbound_at, first_response_at, lead:whatsapp_leads!inner(whatsapp_number, marketing_consent_status)")
        .eq("id", conversationId)
        .maybeSingle();
      if (error) throw error;
      if (!conversation) return json({ error: "Conversation not found" }, 404, corsHeaders);
      const lead = Array.isArray(conversation.lead) ? conversation.lead[0] : conversation.lead;
      const to = digitsOnly((lead as { whatsapp_number?: string } | null)?.whatsapp_number);
      if (to.length < 8 || to.length > 15) return json({ error: "The WhatsApp number is invalid" }, 400, corsHeaders);

      if (campaignRecipientId) {
        // This path is reserved for the service-role campaign worker. Staff
        // sends never accept a campaign-recipient control plane id.
        if (!auth.isServiceRole) {
          return json({ error: "Campaign recipient control is internal only" }, 403, corsHeaders);
        }

        // Marketing campaign dispatches carry a recipient id so a worker crash
        // after the provider accepts the message cannot cause a duplicate send.
        const { data: recipient, error: recipientError } = await admin
          .from("whatsapp_campaign_recipients")
          .select("id,campaign_id,conversation_id,status,provider_message_id")
          .eq("id", campaignRecipientId)
          .maybeSingle();
        if (recipientError) throw recipientError;
        if (!recipient || recipient.conversation_id !== conversationId) {
          return json({ error: "Campaign recipient does not match the conversation" }, 409, corsHeaders);
        }
        if (recipient.status !== "processing") {
          if (recipient.provider_message_id) {
            const { data: existingMessage, error: existingMessageError } = await admin
              .from("whatsapp_messages")
              .select("*")
              .eq("campaign_recipient_id", campaignRecipientId)
              .maybeSingle();
            if (existingMessageError) throw existingMessageError;
            return json({
              message: existingMessage ?? null,
              provider_message_id: recipient.provider_message_id,
              deduplicated: true,
            }, 200, corsHeaders);
          }
          return json({ error: "Campaign recipient is not currently claimable" }, 409, corsHeaders);
        }
        if (!templateId) return json({ error: "Campaign template is required" }, 400, corsHeaders);

        const { data: campaign, error: campaignError } = await admin
          .from("whatsapp_campaigns")
          .select("id,template_id,status")
          .eq("id", recipient.campaign_id)
          .maybeSingle();
        if (campaignError) throw campaignError;
        if (!campaign || campaign.status !== "running" || campaign.template_id !== templateId) {
          return json({ error: "Campaign recipient is not active for this template" }, 409, corsHeaders);
        }

        if (recipient.provider_message_id) {
          const { data: existingMessage, error: existingMessageError } = await admin
            .from("whatsapp_messages")
            .select("*")
            .eq("campaign_recipient_id", campaignRecipientId)
            .maybeSingle();
          if (existingMessageError) throw existingMessageError;
          return json({
            message: existingMessage ?? null,
            provider_message_id: recipient.provider_message_id,
            deduplicated: true,
          }, 200, corsHeaders);
        }
      }

      if (followUpTaskId) {
        // Scheduled follow-ups are dispatched only by the service-role worker.
        // The task status is re-checked immediately before provider delivery so
        // an inbound reply can cancel a claimed task before it is sent.
        if (!auth.isServiceRole) {
          return json({ error: "Follow-up task control is internal only" }, 403, corsHeaders);
        }
        if (!templateId) return json({ error: "Follow-up template is required" }, 400, corsHeaders);

        const { data: task, error: taskError } = await admin
          .from("whatsapp_follow_up_tasks")
          .select("id,conversation_id,kind,status,template_id,provider_message_id")
          .eq("id", followUpTaskId)
          .maybeSingle();
        if (taskError) throw taskError;
        if (!task || task.conversation_id !== conversationId || task.kind !== "template") {
          return json({ error: "Follow-up task does not match the conversation" }, 409, corsHeaders);
        }
        if (task.template_id !== templateId) {
          return json({ error: "Follow-up task does not match the template" }, 409, corsHeaders);
        }
        if (task.status !== "processing") {
          if (task.provider_message_id) {
            const { data: existingMessage, error: existingMessageError } = await admin
              .from("whatsapp_messages")
              .select("*")
              .eq("follow_up_task_id", followUpTaskId)
              .maybeSingle();
            if (existingMessageError) throw existingMessageError;
            return json({
              message: existingMessage ?? null,
              provider_message_id: task.provider_message_id,
              deduplicated: true,
            }, 200, corsHeaders);
          }
          return json({ error: "Follow-up task is no longer claimable" }, 409, corsHeaders);
        }
        if (task.provider_message_id) {
          const { data: existingMessage, error: existingMessageError } = await admin
            .from("whatsapp_messages")
            .select("*")
            .eq("follow_up_task_id", followUpTaskId)
            .maybeSingle();
          if (existingMessageError) throw existingMessageError;
          return json({
            message: existingMessage ?? null,
            provider_message_id: task.provider_message_id,
            deduplicated: true,
          }, 200, corsHeaders);
        }
      }

      const lastInbound = conversation.last_inbound_at ? new Date(conversation.last_inbound_at).getTime() : Number.NaN;
      const insideWindow = Number.isFinite(lastInbound) && Date.now() >= lastInbound && Date.now() - lastInbound <= 24 * 60 * 60 * 1000;
      const mediaPath = input?.media_path ? String(input.media_path) : null;
      const mediaType = String(input?.media_type ?? "document");
      const mediaMime = input?.media_mime ? String(input.media_mime) : null;
      const mediaFilename = input?.media_filename ? String(input.media_filename).slice(0, 200) : null;
      let mediaUrl: string | null = null;
      let providerBody: Record<string, unknown>;
      let storedBody = String(input?.body ?? "").trim();
      let messageType = "text";
      let templateName: string | null = null;

      if (templateId) {
        const { data: template, error: templateError } = await admin.from("whatsapp_templates").select("*").eq("id", templateId).maybeSingle();
        if (templateError) throw templateError;
        if (!template || template.approval_status !== "APPROVED") return json({ error: "Only an approved WhatsApp template can be sent" }, 400, corsHeaders);
        if (template.is_active === false) return json({ error: "This template is switched off" }, 409, corsHeaders);
        if (!isAdmin && template.available_to_team === false) {
          return json({ error: "This template has not been released to the team" }, 403, corsHeaders);
        }
        // Marketing consent is tracked separately from service consent: a
        // marketing template may only go to a contact who explicitly granted it.
        if (String(template.category ?? "").toUpperCase() === "MARKETING") {
          const marketingConsent = String((lead as { marketing_consent_status?: string } | null)?.marketing_consent_status ?? "unknown");
          if (marketingConsent !== "granted") {
            return json({ error: "This contact has not granted marketing consent, so only service templates can be sent" }, 409, corsHeaders);
          }
        }
        const parameters = Array.isArray(input?.parameters) ? input.parameters.map((value: unknown) => String(value).trim()) : [];
        const expected = [...templateBody(template.components).matchAll(/{{\s*(\d+)\s*}}/g)].length;
        if (parameters.length !== expected || parameters.some((value: string) => !value)) return json({ error: "Complete every template field before sending" }, 400, corsHeaders);
        const components = expected ? [{ type: "body", parameters: parameters.map((text: string) => ({ type: "text", text })) }] : [];
        providerBody = { messaging_product: "whatsapp", to, type: "template", template: { name: template.provider_name, language: { code: template.language_code }, components } };
        storedBody = templateBody(template.components) || template.provider_name;
        templateName = template.provider_name;
        messageType = "template";
      } else if (mediaPath) {
        // Attachment: the file already sits in the staff-only bucket, so we hand
        // WhatsApp a short-lived signed URL instead of making the file public.
        if (!insideWindow) return json({ error: "An approved template is required outside the 24-hour service window" }, 409, corsHeaders);
        if (!MEDIA_TYPES.includes(mediaType)) return json({ error: "Unsupported attachment type" }, 400, corsHeaders);
        const { data: signed, error: signedError } = await admin.storage.from("whatsapp-media").createSignedUrl(mediaPath, 60 * 30);
        if (signedError || !signed?.signedUrl) return json({ error: "The attachment could not be prepared for sending" }, 400, corsHeaders);
        mediaUrl = signed.signedUrl;
        const media: Record<string, unknown> = { link: mediaUrl };
        if (storedBody && mediaType !== "audio") media.caption = storedBody.slice(0, 1024);
        if (mediaType === "document" && mediaFilename) media.filename = mediaFilename;
        providerBody = { messaging_product: "whatsapp", to, type: mediaType, [mediaType]: media };
        messageType = mediaType;
        storedBody = storedBody || mediaFilename || "";
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

      const messageInsert: Record<string, unknown> = {
        conversation_id: conversationId,
        provider_message_id: providerMessageId,
        direction: "outbound",
        message_type: messageType,
        body: storedBody,
        template_name: templateName,
        delivery_status: "accepted",
        authored_by: auth.userId,
        sent_at: now,
        media_url: mediaPath,
        media_mime_type: mediaMime,
        media_filename: mediaFilename,
      };
      if (campaignRecipientId) messageInsert.campaign_recipient_id = campaignRecipientId;
      if (followUpTaskId) messageInsert.follow_up_task_id = followUpTaskId;

      const { data: message, error: insertError } = await admin.from("whatsapp_messages").insert(messageInsert).select("*").single();
      if (insertError) throw insertError;

      // Persist the provider id after the outbound message row exists. If the
      // recipient update fails, the dispatcher can recover the message by the
      // campaign_recipient_id without sending to WhatsApp a second time.
      if (campaignRecipientId && providerMessageId) {
        const { error: recipientUpdateError } = await admin
          .from("whatsapp_campaign_recipients")
          .update({ provider_message_id: providerMessageId, updated_at: now })
          .eq("id", campaignRecipientId)
          .eq("status", "processing");
        if (recipientUpdateError) throw recipientUpdateError;
      }

      if (followUpTaskId && providerMessageId) {
        const { error: taskUpdateError } = await admin
          .from("whatsapp_follow_up_tasks")
          .update({ provider_message_id: providerMessageId, updated_at: now })
          .eq("id", followUpTaskId)
          .eq("status", "processing");
        if (taskUpdateError) throw taskUpdateError;
      }
      const { error: updateError } = await admin.from("whatsapp_conversations").update({
        last_outbound_at: now,
        first_response_at: conversation.first_response_at ?? (conversation.last_inbound_at ? now : null),
        last_message_preview: storedBody.slice(0, 240),
      }).eq("id", conversationId);
      if (updateError) throw updateError;
      return json({ message }, 200, corsHeaders);
    }

    return json({ error: "Unsupported action" }, 400, corsHeaders);
  } catch (error) {
    return serverErrorResponse(error, corsHeaders, "WhatsApp action failed");
  }
});