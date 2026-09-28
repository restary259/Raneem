import { WHATSAPP_LEAD_STAGES } from "@/lib/whatsappStages";
import { normalizeWhatsAppState } from "@/lib/whatsappOperational";
import type {
  ConversationState,
  LeadStage,
  WhatsAppThread,
} from "@/services/WhatsAppService";

/** Filter/taxonomy vocabulary shared by the workspace pieces. */
export const DISPLAY_STATES: ConversationState[] = [
  "waiting_for_team",
  "open",
  "waiting_for_student",
  "closed",
];
export const QUICK_TABS = ["all", "unread", "read", "needsReply"] as const;
export type QuickTab = (typeof QUICK_TABS)[number];
export const PRIORITIES = ["normal", "high", "urgent"] as const;
export const INTENTS = [
  "medicine",
  "engineering",
  "computer_science",
  "language_course",
  "visa",
  "accommodation",
  "cost",
  "appointment",
  "documents",
  "application_status",
  "existing_student",
  "other",
] as const;
export const LANGUAGES = ["ar", "he", "en", "unknown"] as const;

/** Quick replies are localized under `quickReplies.*` (en/ar/he), not hardcoded
 *  Arabic — an English or Hebrew staff member must not insert Arabic text. */
export const QUICK_REPLY_IDS = [
  "hello",
  "major",
  "appointment",
  "apply",
  "documents",
  "payment",
] as const;

export const APPOINTMENT_TEMPLATE_PRESETS_AR: Record<string, string> = {
  appointment_confirmation:
    "أهلاً وسهلاً! تم تأكيد موعدك مع فريق درب بخصوص الدراسة بألمانيا. الموعد مثبت عنا، وإذا احتجت أي تعديل، ابعتلنا.",
  appointment_reminder:
    "أهلاً! تذكير من درب: عندك موعد معنا بكرا بخصوص الدراسة بألمانيا. إذا احتجت تغيّر الموعد، ابعتلنا.",
};
export const STAGES: LeadStage[] = WHATSAPP_LEAD_STAGES as LeadStage[];
export const CONSENT = ["unknown", "granted", "declined", "withdrawn"] as const;
export const TEMPLATE_PURPOSES = [
  "lead_received",
  "lead_followup",
  "inquiry_follow_up",
  "appointment_invitation",
  "appointment_confirmation",
  "consultation_confirmation",
  "appointment_reminder",
  "appointment_rescheduled",
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
  "re_engagement",
] as const;
export const KNOWN_TYPES = [
  "image",
  "video",
  "audio",
  "document",
  "sticker",
  "location",
  "contacts",
  "reaction",
];

/** needs_reply is derived, never stored: an inbound message that has no later outbound reply and the conversation is not closed. */
export function threadNeedsReply(thread: WhatsAppThread): boolean {
  if (!thread.last_inbound_at) return false;
  if (normalizeWhatsAppState(thread.state) === "closed") return false;
  const lastIn = new Date(thread.last_inbound_at).getTime();
  const lastOut = thread.last_outbound_at
    ? new Date(thread.last_outbound_at).getTime()
    : Number.NaN;
  return (
    Number.isFinite(lastIn) && (!Number.isFinite(lastOut) || lastIn > lastOut)
  );
}
