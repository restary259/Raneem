import type { WhatsAppMessage } from "@/services/WhatsAppService";

export interface WhatsAppChatGroup {
  direction: "inbound" | "outbound";
  /** ISO day key (yyyy-mm-dd) of the first message in the group. */
  day: string;
  messages: WhatsAppMessage[];
}

/**
 * Group consecutive WhatsApp messages by direction so bubbles stack like a
 * real chat. A new group starts when the direction changes, a day boundary
 * is crossed, or more than `gapMs` passes between consecutive messages.
 * Empty runs are impossible (every message starts its own group).
 */
export function groupWhatsAppMessages(
  messages: WhatsAppMessage[],
  gapMs = 5 * 60 * 1000,
): WhatsAppChatGroup[] {
  const groups: WhatsAppChatGroup[] = [];
  for (const m of messages) {
    const day = new Date(m.created_at).toISOString().slice(0, 10);
    const last = groups[groups.length - 1];
    const lastMsg = last?.messages[last.messages.length - 1];
    const sameRun =
      last &&
      last.day === day &&
      last.direction === m.direction &&
      lastMsg &&
      new Date(m.created_at).getTime() - new Date(lastMsg.created_at).getTime() <= gapMs;
    if (sameRun) {
      last.messages.push(m);
    } else {
      groups.push({ direction: m.direction, day, messages: [m] });
    }
  }
  return groups;
}

/**
 * Rendering hint for `whatsapp_messages.delivery_status`. WhatsApp stamps
 * `accepted` on send and there is no delivery/read webhook in this pipeline,
 * so the UI must not invent read ticks — it only reflects what is stored.
 */
export type DeliveryStatusKind = "sent" | "failed" | "other";

export function deliveryStatusKind(status: string | null | undefined): DeliveryStatusKind {
  if (!status || status === "accepted" || status === "sent") return "sent";
  if (status === "failed" || status === "error") return "failed";
  return "other";
}