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
  input: {
    first_response_at: string | null;
    last_customer_message_at?: string | null;
    last_team_response_at?: string | null;
    sla_due_at?: string | null;
    snoozed_until?: string | null;
    state: string;
  },
  now = Date.now(),
): boolean {
  if (isWhatsAppSnoozed("snoozed", input.snoozed_until, now)) return false;
  if (normalizeWhatsAppState(input.state) === "closed") return false;

  // SLA applies while the team has not answered the latest customer message:
  // either the first response is still outstanding, or a later customer turn is
  // unanswered. Relying on last_customer_message_at alone misses overdue
  // conversations where that timestamp was never recorded.
  const firstResponsePending = !input.first_response_at;
  const customerAt = input.last_customer_message_at ? new Date(input.last_customer_message_at).getTime() : NaN;
  const teamAt = input.last_team_response_at ? new Date(input.last_team_response_at).getTime() : NaN;
  const awaitingTeam = Number.isFinite(customerAt) && (!Number.isFinite(teamAt) || customerAt > teamAt);
  if (!firstResponsePending && !awaitingTeam) return false;

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
