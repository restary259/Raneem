import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

export async function updateLead(id: string, patch: Tables["whatsapp_leads"]["Update"]) {
  const { error } = await supabase.from("whatsapp_leads").update(patch).eq("id", id); fail(error);
}

export async function addInternalNote(conversationId: string, authorId: string, body: string) {
  const { error } = await supabase.from("whatsapp_internal_notes").insert({ conversation_id: conversationId, author_id: authorId, body: body.trim() }); fail(error);
}

export interface AiAssistResult { draft: string; summary: string; escalation_required: boolean; escalation_reasons: string[] }
export async function requestWhatsAppAiAssist(input: { mode: "welcome" | "qualification" | "summary"; lead: WhatsAppLead; messages: WhatsAppMessage[]; instruction?: string; language: "ar" | "en" }) {
  const { data, error } = await supabase.functions.invoke("whatsapp-ai-assist", { body: input });
  fail(error); return data as AiAssistResult;
}
