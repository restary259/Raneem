import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@lovable.dev/webhooks-js";

/**
 * Native Lovable WhatsApp receiver.
 *
 * The WhatsApp Business connector forwards deliveries to this server route after
 * the project is published and selected as the connection's incoming-message
 * destination. This route deliberately contains no browser code and never
 * exposes a service key.
 *
 * Flow:
 *   Lovable connector -> signature verification -> normalization -> Supabase
 *   service-role RPC -> durable/idempotent WhatsApp tables -> realtime inbox
 */

type JsonObject = Record<string, unknown>;

type MetaValue = {
  messages?: JsonObject[];
  statuses?: JsonObject[];
  errors?: JsonObject[];
  contacts?: JsonObject[];
  message_echoes?: JsonObject[];
};

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const asObject = (value: unknown): JsonObject | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const nested = (source: JsonObject, key: string, field: string) => {
  const branch = asObject(source[key]);
  return branch ? str(branch[field]) : null;
};

const isoFromUnix = (value: unknown) => {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : new Date().toISOString();
};

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

function normalizeMessage(
  message: JsonObject,
  contacts: JsonObject[] | undefined,
  direction: "inbound" | "echo",
) {
  const type = str(message.type) ?? "text";
  const text =
    nested(message, "text", "body") ??
    nested(message, "image", "caption") ??
    nested(message, "video", "caption") ??
    nested(message, "document", "caption") ??
    nested(message, "document", "filename") ??
    nested(message, "button", "text") ??
    (() => {
      const interactive = asObject(message.interactive);
      return (
        (interactive && nested(interactive, "button_reply", "title")) ??
        (interactive && nested(interactive, "list_reply", "title")) ??
        ""
      );
    })();

  const media =
    nested(message, "image", "id") ??
    nested(message, "video", "id") ??
    nested(message, "audio", "id") ??
    nested(message, "document", "id") ??
    nested(message, "sticker", "id");

  const profile = asObject(contacts?.[0]?.profile);

  return {
    event_type: direction === "inbound" ? "whatsapp.message" : "whatsapp.message_echo",
    provider_message_id: str(message.id),
    from: direction === "inbound" ? str(message.from) : str(message.to),
    contact_name: str(profile?.name),
    message_type: type,
    text,
    media_provider_id: media,
    reply_to_provider_id: nested(message, "context", "id"),
    occurred_at: isoFromUnix(message.timestamp),
    raw: message,
  };
}

function normalizeStatus(status: JsonObject) {
  const errors = Array.isArray(status.errors)
    ? (status.errors as JsonObject[])
    : [];

  return {
    event_type: "whatsapp.status",
    provider_message_id: str(status.id),
    status: str(status.status),
    recipient: str(status.recipient_id),
    error_status: errors[0]?.code ?? null,
    error_message:
      str(errors[0]?.title) ?? str(errors[0]?.message),
    occurred_at: isoFromUnix(status.timestamp),
    raw: status,
  };
}

function normalizeExistingEvent(event: JsonObject, fallbackEventType: string) {
  return {
    ...event,
    event_type: str(event.event_type) ?? str(event.type) ?? fallbackEventType,
    raw: event.raw ?? event,
  };
}

function buildEvents(
  payload: JsonObject,
  fallbackEventType: string,
): JsonObject[] {
  // Be tolerant of either a connector-normalized envelope or the raw Meta
  // WhatsApp change payload. This makes the receiver resilient to connector
  // envelope changes without weakening signature verification.
  const suppliedEvents =
    (Array.isArray(payload.events) ? payload.events : null) ??
    (() => {
      const data = asObject(payload.data);
      return data && Array.isArray(data.events) ? data.events : null;
    })();

  if (suppliedEvents) {
    return suppliedEvents
      .map((event) => asObject(event))
      .filter((event): event is JsonObject => !!event)
      .map((event) => normalizeExistingEvent(event, fallbackEventType));
  }

  const metaPayload =
    Array.isArray(payload.entry)
      ? payload
      : asObject(payload.data) ?? payload;

  const entries = Array.isArray(metaPayload.entry)
    ? (metaPayload.entry as JsonObject[])
    : [];

  const events: JsonObject[] = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes)
      ? (entry.changes as JsonObject[])
      : [];

    for (const change of changes) {
      const value = asObject(change.value) as MetaValue | null;
      if (!value) {
        events.push({
          event_type: fallbackEventType,
          occurred_at: new Date().toISOString(),
          raw: change,
        });
        continue;
      }

      for (const message of value.messages ?? []) {
        events.push(normalizeMessage(message, value.contacts, "inbound"));
      }

      // Echoes describe messages sent by the business. They are NOT inbound
      // customer messages and must never increment unread_count or reopen a
      // conversation as if the customer had replied.
      for (const echo of value.message_echoes ?? []) {
        events.push(normalizeMessage(echo, value.contacts, "echo"));
      }

      for (const status of value.statuses ?? []) {
        events.push(normalizeStatus(status));
      }

      if (
        !value.messages?.length &&
        !value.statuses?.length &&
        !value.message_echoes?.length
      ) {
        events.push({
          event_type: fallbackEventType,
          occurred_at: new Date().toISOString(),
          raw: change,
        });
      }
    }
  }

  if (!entries.length) {
    events.push({
      event_type: fallbackEventType,
      occurred_at: new Date().toISOString(),
      raw: payload,
    });
  }

  return events;
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async () =>
        new Response("DARB WhatsApp receiver is online", {
          status: 200,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
          },
        }),

      POST: async ({ request }) => {
        // Lovable webhook verification uses the project's Lovable API key.
        // Keep the legacy connector key as a compatibility fallback because
        // older connector setups may also expose a WhatsApp-specific secret.
        // Neither key is ever returned or logged.
        const secrets = Array.from(
          new Set(
            [process.env.LOVABLE_API_KEY, process.env.WHATSAPP_API_KEY].filter(
              (value): value is string => !!value?.trim(),
            ),
          ),
        );

        if (!secrets.length) {
          return new Response("WhatsApp receiver is not configured", {
            status: 503,
            headers: { "cache-control": "no-store" },
          });
        }

        let payload: JsonObject | null = null;

        // Try each available signing secret against an independent request
        // clone. This supports the current Lovable webhook secret as well as
        // the legacy connector-specific secret without accepting unsigned data.
        for (const secret of secrets) {
          try {
            const verified =
              await verifyWebhookRequest<JsonObject>({
                req: request.clone(),
                secret,
                // WhatsApp Business history/import deliveries can be large.
                maxBodyBytes: 4 * 1024 * 1024,
              });
            payload = verified.payload;
            break;
          } catch {
            // Try the next configured secret.
          }
        }

        if (!payload) {
          return new Response("Invalid signature", {
            status: 401,
            headers: { "cache-control": "no-store" },
          });
        }

        const deliveryHeader = request.headers.get("X-Lovable-Delivery");
        const eventHeader =
          str(request.headers.get("X-Lovable-Event")) ??
          str(payload.event_type) ??
          str(payload.event) ??
          str(payload.type) ??
          "whatsapp";

        // Prefer Lovable's event/delivery identifier. The content hash is a
        // deterministic last-resort idempotency key if a delivery id was not
        // included in an unusual connector envelope.
        const deliveryId =
          deliveryHeader?.trim() ||
          str(payload.event_id) ||
          str(payload.id) ||
          (await sha256(JSON.stringify(payload)));

        if (!deliveryId) {
          return new Response("Missing delivery identifier", {
            status: 400,
            headers: { "cache-control": "no-store" },
          });
        }

        const events = buildEvents(payload, eventHeader);

        try {
          // This module is server-only. Never import it from a client component.
          const { supabaseAdmin } =
            await import("@/integrations/supabase/client.server");

          const { error } = await supabaseAdmin.rpc(
            "whatsapp_ingest_event",
            {
              p_payload: JSON.parse(
                JSON.stringify({
                  delivery_id: deliveryId,
                  event: eventHeader,
                  events,
                }),
              ),
            },
          );

          if (error) throw error;
        } catch (error) {
          // 5xx deliberately asks Lovable to retry. The DARB delivery ledger
          // makes retries idempotent, so a transient database failure cannot
          // create duplicate messages.
          console.error("whatsapp_ingest_failed", {
            delivery_id: deliveryId,
            event: eventHeader,
            message:
              error instanceof Error ? error.message : "unknown",
          });

          return new Response("Ingest failed", {
            status: 500,
            headers: { "cache-control": "no-store" },
          });
        }

        return new Response("ok", {
          status: 200,
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
