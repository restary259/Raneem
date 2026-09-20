import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@lovable.dev/webhooks-js";

/**
 * WhatsApp receiver. The gateway posts every change Meta sends for the
 * connected number to this exact path, so the path is a contract — do not move
 * it. The handler only verifies, normalizes and forwards: all persistence and
 * idempotency live in the service-role RPC `whatsapp_ingest_event`.
 */

type MetaValue = {
  messages?: Record<string, unknown>[];
  statuses?: Record<string, unknown>[];
  errors?: Record<string, unknown>[];
  contacts?: Record<string, unknown>[];
  message_echoes?: Record<string, unknown>[];
};

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const nested = (source: Record<string, unknown>, key: string, field: string) => {
  const branch = source[key];
  if (!branch || typeof branch !== "object") return null;
  return str((branch as Record<string, unknown>)[field]);
};
const isoFromUnix = (value: unknown) => {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
};

function normalizeMessage(message: Record<string, unknown>, contacts: Record<string, unknown>[] | undefined, direction: "inbound" | "echo") {
  const type = str(message["type"]) ?? "text";
  const text =
    nested(message, "text", "body") ??
    nested(message, "image", "caption") ??
    nested(message, "video", "caption") ??
    nested(message, "document", "caption") ??
    nested(message, "document", "filename") ??
    nested(message, "button", "text") ??
    "";
  const media =
    nested(message, "image", "id") ??
    nested(message, "video", "id") ??
    nested(message, "audio", "id") ??
    nested(message, "document", "id") ??
    nested(message, "sticker", "id");
  const profile = contacts?.[0]?.["profile"];
  return {
    event_type: "whatsapp.message",
    provider_message_id: str(message["id"]),
    from: direction === "inbound" ? str(message["from"]) : str(message["to"]),
    contact_name: profile && typeof profile === "object" ? str((profile as Record<string, unknown>)["name"]) : null,
    message_type: type,
    text,
    media_provider_id: media,
    reply_to_provider_id: nested(message, "context", "id"),
    occurred_at: isoFromUnix(message["timestamp"]),
    raw: message,
  };
}

function normalizeStatus(status: Record<string, unknown>) {
  const errors = Array.isArray(status["errors"]) ? (status["errors"] as Record<string, unknown>[]) : [];
  return {
    event_type: "whatsapp.status",
    provider_message_id: str(status["id"]),
    status: str(status["status"]),
    recipient: str(status["recipient_id"]),
    error_status: errors[0]?.["code"] ?? null,
    error_message: str(errors[0]?.["title"]) ?? str(errors[0]?.["message"]),
    occurred_at: isoFromUnix(status["timestamp"]),
    raw: status,
  };
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WHATSAPP_API_KEY"];
        if (!secret) return new Response("WhatsApp is not configured", { status: 503 });

        const deliveryId = request.headers.get("X-Lovable-Delivery");
        const eventHeader = request.headers.get("X-Lovable-Event");
        if (!deliveryId?.trim() || !eventHeader?.trim()) {
          return new Response("Missing delivery headers", { status: 400 });
        }

        let payload: Record<string, unknown>;
        try {
          const verified = await verifyWebhookRequest<Record<string, unknown>>({
            req: request,
            secret,
            // WhatsApp Business app history chunks reach ~3 MB.
            maxBodyBytes: 4 * 1024 * 1024,
          });
          payload = verified.payload;
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        const entries = Array.isArray(payload["entry"]) ? (payload["entry"] as Record<string, unknown>[]) : [];
        const events: Record<string, unknown>[] = [];
        for (const entry of entries) {
          const changes = Array.isArray(entry["changes"]) ? (entry["changes"] as Record<string, unknown>[]) : [];
          for (const change of changes) {
            const value = (change["value"] ?? {}) as MetaValue;
            for (const message of value.messages ?? []) events.push(normalizeMessage(message, value.contacts, "inbound"));
            for (const echo of value.message_echoes ?? []) events.push(normalizeMessage(echo, value.contacts, "echo"));
            for (const status of value.statuses ?? []) events.push(normalizeStatus(status));
            if (!value.messages?.length && !value.statuses?.length && !value.message_echoes?.length) {
              events.push({ event_type: eventHeader, occurred_at: new Date().toISOString(), raw: change });
            }
          }
        }
        if (!entries.length) {
          events.push({ event_type: eventHeader, occurred_at: new Date().toISOString(), raw: payload });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.rpc("whatsapp_ingest_event", {
            p_payload: JSON.parse(JSON.stringify({ delivery_id: deliveryId, event: eventHeader, events })),
          });
          if (error) throw error;
        } catch (error) {
          // 5xx so the gateway retries with the same delivery id.
          console.error("whatsapp_ingest_failed", { delivery_id: deliveryId, event: eventHeader, message: error instanceof Error ? error.message : "unknown" });
          return new Response("Ingest failed", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
