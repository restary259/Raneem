import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { readFunctionError } from "@/lib/functionError";

type Tables = Database["public"]["Tables"];
export type WhatsAppLead = Tables["whatsapp_leads"]["Row"];
export type WhatsAppConversation = Tables["whatsapp_conversations"]["Row"];
export type WhatsAppMessage = Tables["whatsapp_messages"]["Row"];
export type WhatsAppNote = Tables["whatsapp_internal_notes"]["Row"];
export type WhatsAppTemplate = Tables["whatsapp_templates"]["Row"];
export type StaffMember = { id: string; full_name: string };
export type ConversationState = "new" | "open" | "waiting" | "resolved" | "waiting_for_team" | "waiting_for_student" | "snoozed" | "closed";
export type WhatsAppPriority = "normal" | "high" | "urgent";
export type LeadStage = "new" | "qualified" | "consultation_booked" | "documents_pending" | "application_in_progress" | "won" | "lost";

export interface WhatsAppThread extends WhatsAppConversation { lead: WhatsAppLead }

export type WhatsAppCrmLead = Pick<Tables["leads"]["Row"], "id" | "full_name" | "status" | "source_type" | "city" | "preferred_major" | "education_level">;
export type WhatsAppCrmCase = Pick<Tables["cases"]["Row"], "id" | "full_name" | "status" | "case_reference" | "city" | "degree_interest" | "education_level" | "assigned_to"> & { assigned_to_name: string | null };
export type WhatsAppCrmProfile = Pick<Tables["profiles"]["Row"], "id" | "full_name" | "student_status" | "city" | "university_name">;
export interface WhatsAppCrmContext {
  leadRecord: WhatsAppCrmLead | null;
  caseRecord: WhatsAppCrmCase | null;
  profile: WhatsAppCrmProfile | null;
}

const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

export async function listWhatsAppThreads(): Promise<WhatsAppThread[]> {
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("*, lead:whatsapp_leads(*)")
    .order("updated_at", { ascending: false });
  fail(error);
  return (data ?? []) as unknown as WhatsAppThread[];
}

export async function listConversationMessages(conversationId: string) {
  const { data, error } = await supabase.from("whatsapp_messages").select("*").eq("conversation_id", conversationId).order("created_at");
  fail(error); return (data ?? []) as WhatsAppMessage[];
}

export async function listConversationNotes(conversationId: string) {
  const { data, error } = await supabase.from("whatsapp_internal_notes").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: false });
  fail(error); return (data ?? []) as WhatsAppNote[];
}

export async function listWhatsAppTemplates() {
  const { data, error } = await supabase.from("whatsapp_templates").select("*").order("purpose");
  fail(error); return (data ?? []) as WhatsAppTemplate[];
}

export async function listWhatsAppStaff() {
  const { data, error } = await supabase.rpc("get_whatsapp_staff_directory");
  fail(error); return (data ?? []) as StaffMember[];
}

export async function updateConversation(id: string, patch: Tables["whatsapp_conversations"]["Update"]) {
  const { error } = await supabase.from("whatsapp_conversations").update(patch).eq("id", id); fail(error);
}

/** Clears the unread badge when staff open a conversation. Touches nothing else. */
export async function markConversationRead(id: string) {
  const { error } = await supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", id).gt("unread_count", 0);
  fail(error);
}

export interface WhatsAppInboundStatus { lastInboundAt: string | null; inboundCount: number; unrecognisedCount: number }

/**
 * Honest receiving status: derived only from what is actually stored.
 * The unrecognised counter reads whatsapp_ingest_log (admin-only); a denied
 * read is reported as 0 rather than failing the page.
 */
export async function getWhatsAppInboundStatus(): Promise<WhatsAppInboundStatus> {
  const [inbound, latest, unrecognised] = await Promise.all([
    supabase.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("direction", "inbound"),
    supabase.from("whatsapp_messages").select("created_at").eq("direction", "inbound").order("created_at", { ascending: false }).limit(1),
    supabase.from("whatsapp_ingest_log").select("id", { count: "exact", head: true }),
  ]);
  return {
    lastInboundAt: latest.data?.[0]?.created_at ?? null,
    inboundCount: inbound.count ?? 0,
    unrecognisedCount: unrecognised.count ?? 0,
  };
}

export async function getWhatsAppCrmContext(
  whatsappLeadId: string,
): Promise<WhatsAppCrmContext> {
  const { data, error } = await supabase.rpc("whatsapp_crm_context", {
    p_whatsapp_lead_id: whatsappLeadId,
  });
  fail(error);

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return { leadRecord: null, caseRecord: null, profile: null };
  }

  return {
    leadRecord: row.lead_id
      ? {
          id: row.lead_id,
          full_name: row.lead_full_name,
          status: row.lead_status,
          source_type: row.lead_source_type,
          city: row.lead_city,
          preferred_major: row.lead_preferred_major,
          education_level: row.lead_education_level,
        }
      : null,
    caseRecord: row.case_id
      ? {
          id: row.case_id,
          full_name: row.case_full_name,
          status: row.case_status,
          case_reference: row.case_reference,
          city: row.case_city,
          degree_interest: row.case_degree_interest,
          education_level: row.case_education_level,
          assigned_to: row.case_assigned_to,
          assigned_to_name: row.case_assigned_to_name,
        }
      : null,
    profile: row.profile_id
      ? {
          id: row.profile_id,
          full_name: row.profile_full_name,
          student_status: row.profile_student_status,
          city: row.profile_city,
          university_name: row.profile_university_name,
        }
      : null,
  };
}

export type IdentitySuggestion = Database["public"]["Functions"]["whatsapp_identity_suggestions"]["Returns"][number];

/**
 * Phone-based match suggestions against existing leads, cases and profiles.
 * Read-only: automatic identity resolution happens server-side for unambiguous
 * exact phone matches; unresolved suggestions remain a staff confirmation flow.
 */
export async function getIdentitySuggestions(whatsappLeadId: string): Promise<IdentitySuggestion[]> {
  const { data, error } = await supabase.rpc("whatsapp_identity_suggestions", { p_whatsapp_lead_id: whatsappLeadId });
  fail(error);
  return (data ?? []) as IdentitySuggestion[];
}

/** Staff confirmation of an identity match. Never creates a lead or a case. */
export async function linkWhatsAppIdentity(whatsappLeadId: string, target: { lead_id?: string; case_id?: string; profile_id?: string }) {
  const { error } = await supabase.rpc("whatsapp_link_identity", {
    p_whatsapp_lead_id: whatsappLeadId,
    p_lead_id: target.lead_id,
    p_case_id: target.case_id,
    p_profile_id: target.profile_id,
  });
  fail(error);
}

export async function unlinkWhatsAppIdentity(whatsappLeadId: string) {
  const { error } = await supabase.rpc("whatsapp_unlink_identity", { p_whatsapp_lead_id: whatsappLeadId });
  fail(error);
}

export async function updateLead(id: string, patch: Tables["whatsapp_leads"]["Update"]) {
  const { error } = await supabase.from("whatsapp_leads").update(patch).eq("id", id); fail(error);
}

export async function addInternalNote(conversationId: string, authorId: string, body: string) {
  const { error } = await supabase.from("whatsapp_internal_notes").insert({ conversation_id: conversationId, author_id: authorId, body: body.trim() }); fail(error);
}

export interface AiAssistResult { draft: string; summary: string; escalation_required: boolean; escalation_reasons: string[] }
export async function requestWhatsAppAiAssist(input: { mode: "welcome" | "qualification" | "summary"; lead: WhatsAppLead; messages: WhatsAppMessage[]; instruction?: string; language: "ar" | "en" | "he" }) {
  const { data, error } = await supabase.functions.invoke("whatsapp-ai-assist", { body: input });
  if (error) throw new Error(await readFunctionError(error));
  return data as AiAssistResult;
}

async function invokeWhatsAppConnector<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("whatsapp-connector", { body });
  if (error) throw new Error(await readFunctionError(error));
  return data as T;
}

export function sendWhatsAppText(conversationId: string, body: string) {
  return invokeWhatsAppConnector<{ message: WhatsAppMessage }>({ action: "send", conversation_id: conversationId, body });
}

const MEDIA_KIND = (mime: string) =>
  mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "document";

/**
 * Attachments live in the staff-only whatsapp-media bucket; the connector
 * hands WhatsApp a short-lived signed URL, so the file is never public.
 */
export async function sendWhatsAppMedia(conversationId: string, file: File, caption: string) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
  const path = conversationId + "/" + Date.now() + "-" + safeName;
  const { error } = await supabase.storage.from("whatsapp-media").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  fail(error);
  return invokeWhatsAppConnector<{ message: WhatsAppMessage }>({
    action: "send",
    conversation_id: conversationId,
    body: caption,
    media_path: path,
    media_type: MEDIA_KIND(file.type || ""),
    media_mime: file.type || null,
    media_filename: file.name,
  });
}

/** Signed URL so staff can open an attachment from the private bucket. */
export async function whatsAppMediaUrl(path: string) {
  const { data, error } = await supabase.storage.from("whatsapp-media").createSignedUrl(path, 60 * 60);
  fail(error);
  return data?.signedUrl ?? null;
}

export function sendWhatsAppTemplate(conversationId: string, templateId: string, parameters: string[]) {
  return invokeWhatsAppConnector<{ message: WhatsAppMessage }>({ action: "send", conversation_id: conversationId, template_id: templateId, parameters });
}

export function syncWhatsAppTemplates() {
  return invokeWhatsAppConnector<{ synced: number }>({ action: "sync_templates" });
}

export function createWhatsAppTemplate(input: { purpose: string; language: "ar" | "en" | "he"; category: "UTILITY" | "MARKETING"; body: string }) {
  return invokeWhatsAppConnector<{ created: boolean; provider_name: string; approval_status: "PENDING" }>({ action: "create_template", ...input });
}

// Admin-only: switch a template on/off, or release it to the team.
export function setWhatsAppTemplateFlags(templateId: string, flags: { is_active?: boolean; available_to_team?: boolean }) {
  return invokeWhatsAppConnector<{ template: WhatsAppTemplate }>({ action: "set_template_flags", template_id: templateId, ...flags });
}

export async function setWhatsAppConversationAssignment(conversationId: string, assignedTo: string | null) {
  const { data, error } = await supabase.rpc("whatsapp_set_conversation_assignment", {
    p_conversation_id: conversationId,
    p_assigned_to: assignedTo,
  });
  fail(error);
  return data;
}

export async function snoozeWhatsAppConversation(conversationId: string, until: string) {
  const { data, error } = await supabase.rpc("whatsapp_snooze_conversation", {
    p_conversation_id: conversationId,
    p_until: until,
  });
  fail(error);
  return data;
}

export async function resumeWhatsAppConversation(conversationId: string) {
  const { data, error } = await supabase.rpc("whatsapp_resume_conversation", {
    p_conversation_id: conversationId,
  });
  fail(error);
  return data;
}

export async function scheduleWhatsAppTemplateFollowUp(
  conversationId: string,
  dueAt: string,
  templateId: string,
  parameters: string[] = [],
) {
  const { data, error } = await supabase.rpc("whatsapp_schedule_template_follow_up", {
    p_conversation_id: conversationId,
    p_due_at: dueAt,
    p_template_id: templateId,
    p_parameters: parameters,
  });
  fail(error);
  return data;
}

export function startWhatsAppConversation(
  whatsappNumber: string,
  studentName = "",
  target?: { case_id?: string; lead_id?: string; profile_id?: string },
) {
  return invokeWhatsAppConnector<{ created: boolean; lead: WhatsAppLead; conversation: WhatsAppConversation }>({
    action: "start_conversation",
    whatsapp_number: whatsappNumber,
    student_name: studentName,
    ...(target?.case_id ? { case_id: target.case_id } : {}),
    ...(target?.lead_id ? { lead_id: target.lead_id } : {}),
    ...(target?.profile_id ? { profile_id: target.profile_id } : {}),
  });
}
