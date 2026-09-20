import { describe, expect, it } from "vitest";
import {
  deliveryStatusKind,
  groupWhatsAppMessages,
} from "@/lib/whatsappChat";
import type { WhatsAppMessage } from "@/services/WhatsAppService";

function msg(over: Partial<WhatsAppMessage> & Pick<WhatsAppMessage, "id" | "created_at" | "direction">): WhatsAppMessage {
  return {
    body: "hi",
    conversation_id: "c1",
    direction: "inbound",
    message_type: "text",
    delivery_status: "accepted",
    ...over,
  } as WhatsAppMessage;
}

describe("whatsappChat", () => {
  it("groups consecutive same-direction messages", () => {
    const groups = groupWhatsAppMessages([
      msg({ id: "1", direction: "inbound", created_at: "2026-09-20T10:00:00.000Z" }),
      msg({ id: "2", direction: "inbound", created_at: "2026-09-20T10:01:00.000Z" }),
      msg({ id: "3", direction: "outbound", created_at: "2026-09-20T10:02:00.000Z" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].direction).toBe("inbound");
    expect(groups[0].messages.map((m) => m.id)).toEqual(["1", "2"]);
    expect(groups[1].direction).toBe("outbound");
  });

  it("starts a new group after a long gap or a new day", () => {
    const groups = groupWhatsAppMessages([
      msg({ id: "1", direction: "inbound", created_at: "2026-09-20T10:00:00.000Z" }),
      msg({ id: "2", direction: "inbound", created_at: "2026-09-20T10:30:00.000Z" }),
      msg({ id: "3", direction: "inbound", created_at: "2026-09-21T10:31:00.000Z" }),
    ]);
    expect(groups).toHaveLength(3);
  });

  it("honours a custom gap window", () => {
    const groups = groupWhatsAppMessages(
      [
        msg({ id: "1", direction: "inbound", created_at: "2026-09-20T10:00:00.000Z" }),
        msg({ id: "2", direction: "inbound", created_at: "2026-09-20T10:03:00.000Z" }),
      ],
      120_000,
    );
    expect(groups).toHaveLength(2);
  });

  it("returns one group per message for empty input safety", () => {
    expect(groupWhatsAppMessages([])).toEqual([]);
  });

  it("maps delivery status to a render hint", () => {
    expect(deliveryStatusKind("accepted")).toBe("sent");
    expect(deliveryStatusKind("sent")).toBe("sent");
    expect(deliveryStatusKind(null)).toBe("sent");
    expect(deliveryStatusKind(undefined)).toBe("sent");
    expect(deliveryStatusKind("failed")).toBe("failed");
    expect(deliveryStatusKind("error")).toBe("failed");
    expect(deliveryStatusKind("delivered")).toBe("other");
    expect(deliveryStatusKind("read")).toBe("other");
  });
});