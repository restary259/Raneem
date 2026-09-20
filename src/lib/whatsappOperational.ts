export const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const WHATSAPP_FIRST_RESPONSE_SLA_MINUTES = 30;

export type WhatsAppPriority = "normal" | "high" | "urgent";
export type WhatsAppOperationalState =
  | "open"
  | "waiting_for_team"
  | "waiting_for_student"
  | "snoozed"
  | "closed";

export function normalizeWhatsAppState(state: string): WhatsAppOperationalState {
  switch (state) {
    case "new":
    case "waiting":
      return "waiting_for_team";
    case "resolved":
      return "closed";
    case "open":
    case "waiting_for_team":
    case "waiting_for_student":
    case "snoozed":
    case "closed":
      return state;
    default:
      return "open";
  }
}

export function isWhatsAppSnoozed(state: string, snoozedUntil: string | null | undefined, now = Date.now()): boolean {
  if (state !== "snoozed" || !snoozedUntil) return false;
  const timestamp = new Date(snoozedUntil).getTime();
  return Number.isFinite(timestamp) && timestamp > now;
}

export function isWhatsAppSlaOverdue(
  input: { first_response_at: string | null; sla_due_at?: string | null; snoozed_until?: string | null; state: string },
  now = Date.now(),
): boolean {
  if (input.first_response_at) return false;
  if (isWhatsAppSnoozed("snoozed", input.snoozed_until, now)) return false;
  if (normalizeWhatsAppState(input.state) === "closed") return false;
  if (!input.sla_due_at) return false;
  const due = new Date(input.sla_due_at).getTime();
  return Number.isFinite(due) && due <= now;
}

export function serviceWindowRemaining(lastInboundAt: string | null, now = Date.now()): number | null {
  if (!lastInboundAt) return null;
  const last = new Date(lastInboundAt).getTime();
  if (!Number.isFinite(last)) return null;
  const remaining = last + WHATSAPP_SERVICE_WINDOW_MS - now;
  return remaining > 0 ? remaining : 0;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms <= 0) return "0m";
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}
