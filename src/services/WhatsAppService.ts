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
export type ConversationState = "new" | "open" | "waiting" | "resolved";
export type LeadStage = "new" | "qualified" | "consultation_booked" | "documents_pending" | "application_in_progress" | "won" | "lost";

export interface WhatsAppThread extends WhatsAppConversation { lead: WhatsAppLead }

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

export async function updateLead(id: string, patch: Tables["whatsapp_leads"]["Update"]) {
  const { error } = await supabase.from("whatsapp_leads").update(patch).eq("id", id); fail(error);
}

export async function addInternalNote(conversationId: string, authorId: string, body: string) {
  const { error } = await supabase.from("whatsapp_internal_notes").insert({ conversation_id: conversationId, author_id: authorId, body: body.trim() }); fail(error);
}

export interface AiAssistResult { draft: string; summary: string; escalation_required: boolean; escalation_reasons: string[] }
export async function requestWhatsAppAiAssist(input: { mode: "welcome" | "qualification" | "summary"; lead: WhatsAppLead; messages: WhatsAppMessage[]; instruction?: string; language: "ar" | "en" }) {
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

export function sendWhatsAppTemplate(conversationId: string, templateId: string, parameters: string[]) {
  return invokeWhatsAppConnector<{ message: WhatsAppMessage }>({ action: "send", conversation_id: conversationId, template_id: templateId, parameters });
}

export function syncWhatsAppTemplates() {
  return invokeWhatsAppConnector<{ synced: number }>({ action: "sync_templates" });
}

export function createWhatsAppTemplate(input: { purpose: string; language: "ar" | "en"; category: "UTILITY" | "MARKETING"; body: string }) {
  return invokeWhatsAppConnector<{ created: boolean; provider_name: string; approval_status: "PENDING" }>({ action: "create_template", ...input });
}

export function startWhatsAppConversation(whatsappNumber: string, studentName = "") {
  return invokeWhatsAppConnector<{ created: boolean; lead: WhatsAppLead; conversation: WhatsAppConversation }>({
    action: "start_conversation",
    whatsapp_number: whatsappNumber,
    student_name: studentName,
  });
}
