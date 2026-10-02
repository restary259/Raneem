import { createFileRoute } from "@tanstack/react-router";
import {
  GOOGLE_JWKS_URI,
  GOOGLE_PUBSUB_SERVICE_ACCOUNT,
  OidcVerificationError,
  bearerToken,
  createJwksCache,
  verifyGoogleOidc,
} from "@/lib/googlePubSubAuth";
import {
  classifyGoogleBusinessEvent,
  decodePubSubEnvelope,
} from "@/lib/googleBusinessEvents";

/**
 * Phase 9 — Google Business Profile Pub/Sub push receiver.
 *
 * This route is deliberately thin: authenticate, validate, persist + queue,
 * acknowledge. It never calls Google or sends notifications inline, so a slow
 * Google API cannot cause Pub/Sub to redeliver a message that DARB already
 * accepted.
 *
 * Authentication is Google's OIDC token (verified against Google's JWKS), not a
 * shared secret, which is what Pub/Sub's authenticated push configuration is
 * for. The office is never taken from the payload; the database derives it from
 * the Google location mapping.
 *
 * Response contract:
 *   2xx  captured (or already seen) — Pub/Sub acks
 *   400  malformed/oversized — never retried, the payload will not improve
 *   401/403  authentication failed — reject
 *   500  transient failure — Pub/Sub retries, then dead-letters
 */

const MAX_BODY_BYTES = 262_144; // 256 KiB, matching the event table's cap.

const jwks = createJwksCache(
  async (uri) => {
    const res = await fetch(uri, { headers: { accept: "application/json" } });
    if (!res.ok)
      throw new OidcVerificationError(
        "BAD_JWKS",
        `JWKS fetch failed: ${res.status}`,
      );
    return res.json();
  },
  3600,
  GOOGLE_JWKS_URI,
);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

/** The expected `aud`: an explicit override, else this endpoint's own URL. */
function expectedAudience(request: Request): string {
  const configured = process.env["GOOGLE_PUBSUB_AUDIENCE"];
  if (configured && configured.trim()) return configured.trim();
  const url = new URL(request.url);
  return `${url.origin}${url.pathname}`;
}

export const Route = createFileRoute("/api/public/google-business/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Size guard before touching the body.
        const declaredLength = Number(
          request.headers.get("content-length") ?? "0",
        );
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > MAX_BODY_BYTES
        ) {
          return json({ error: "payload_too_large" }, 413);
        }

        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
          return json({ error: "payload_too_large" }, 413);
        }

        // 2. Authenticate the push request.
        const token = bearerToken(request.headers.get("authorization"));
        if (!token) {
          return json({ error: "missing_authorization" }, 401);
        }

        const audience = expectedAudience(request);
        let verified = false;
        try {
          await verifyGoogleOidc(token, {
            audience,
            jwks: await jwks.get(),
            allowedEmails: [GOOGLE_PUBSUB_SERVICE_ACCOUNT],
          });
          verified = true;
        } catch (e) {
          // Google rotates keys; a kid miss gets exactly one refetch.
          if (e instanceof OidcVerificationError && e.code === "UNKNOWN_KEY") {
            try {
              await verifyGoogleOidc(token, {
                audience,
                jwks: await jwks.get(true),
                allowedEmails: [GOOGLE_PUBSUB_SERVICE_ACCOUNT],
              });
              verified = true;
            } catch (retryError) {
              logAuthFailure(retryError);
            }
          } else {
            logAuthFailure(e);
          }
        }
        if (!verified) return json({ error: "unauthorized" }, 401);

        // 3. Structural validation.
        let envelope;
        let event;
        try {
          envelope = decodePubSubEnvelope(JSON.parse(raw));
          event = classifyGoogleBusinessEvent(envelope.data);
        } catch (e) {
          const message = e instanceof Error ? e.message : "invalid event";
          console.warn("google_webhook_invalid_event", { message });
          // A malformed body will never become valid on redelivery.
          return json({ error: "invalid_event", message }, 400);
        }

        // 4. Persist + route. Transient failures return 500 so Pub/Sub retries.
        try {
          const { captureAndRouteGoogleEvent } =
            await import("@/lib/googleBusinessRealtime.functions");
          const result = await captureAndRouteGoogleEvent(
            envelope.messageId,
            event,
            envelope.data,
          );
          return json({ ok: true, ...result }, 200);
        } catch (e) {
          const message = e instanceof Error ? e.message : "capture failed";
          console.error("google_webhook_capture_failed", {
            message,
            message_id: envelope.messageId,
          });
          return json({ error: "capture_failed" }, 500);
        }
      },
    },
  },
});

function logAuthFailure(error: unknown): void {
  const code =
    error instanceof OidcVerificationError ? error.code : "BAD_TOKEN";
  console.warn("google_webhook_auth_failed", { code });
}
