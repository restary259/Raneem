/**
 * Phase 9 — Google Business notification event parsing (pure, client-safe).
 *
 * The Pub/Sub push endpoint receives a Google `Notification` wrapped in a
 * Pub/Sub envelope. Nothing here performs I/O or touches node-only APIs, so the
 * same code runs in the webhook and in unit tests.
 *
 * Two rules the whole pipeline depends on:
 *   1. The DARB office is NEVER taken from the payload. It is resolved from the
 *      Google location resource name by the database (`resolve_google_event_office`).
 *   2. An unrecognised Google event type is classified as UNKNOWN and ignored,
 *      never treated as a crash — Google adds notification types over time.
 */

/** Notification types DARB subscribes to. */
export const GBP_SUPPORTED_EVENT_TYPES = [
  "GOOGLE_UPDATE",
  "NEW_REVIEW",
  "UPDATED_REVIEW",
  "NEW_CUSTOMER_MEDIA",
  "DUPLICATE_LOCATION",
  "VOICE_OF_MERCHANT_UPDATED",
  "UPDATED_LOCATION_STATE",
] as const;

export type GbpSupportedEventType = (typeof GBP_SUPPORTED_EVENT_TYPES)[number];

/**
 * Google deprecated the Q&A notification types when the Q&A API was retired, so
 * DARB must not build that workflow. They are recognised only so they can be
 * ignored explicitly rather than falling through as UNKNOWN noise.
 */
export const GBP_DEPRECATED_EVENT_TYPES = [
  "NEW_QUESTION",
  "UPDATED_QUESTION",
  "NEW_ANSWER",
  "UPDATED_ANSWER",
  "LOSS_OF_VOICE_OF_MERCHANT",
] as const;

export type GbpDeprecatedEventType =
  (typeof GBP_DEPRECATED_EVENT_TYPES)[number];

const SUPPORTED_SET = new Set<string>(GBP_SUPPORTED_EVENT_TYPES);
const DEPRECATED_SET = new Set<string>(GBP_DEPRECATED_EVENT_TYPES);

/** DARB's normalized event type. */
export type GbpEventClassification = GbpSupportedEventType | "UNKNOWN";

export type GoogleBusinessEvent = {
  /** DARB's classification: a supported type, or UNKNOWN. */
  eventType: GbpEventClassification;
  /** The type exactly as Google sent it, upper-cased. */
  rawType: string;
  /** accounts/{id}, when the notification names it. */
  googleAccountId: string | null;
  /** locations/{id} — the bare id, never the display name. */
  googleLocationId: string | null;
  /** The full location resource name as Google sent it. */
  googleResourceName: string | null;
  googleReviewId: string | null;
  googleMediaId: string | null;
  /** Google's own notification resource name, when present. */
  googleEventId: string | null;
  /** True for a type Google has retired (Q&A, legacy VOM). */
  deprecated: boolean;
  supported: boolean;
};

export class GoogleEventParseError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GoogleEventParseError";
    this.code = code;
  }
}

/** Last path segment of a Google resource name. */
export function lastResourceSegment(
  resourceName: string | null | undefined,
): string | null {
  if (typeof resourceName !== "string") return null;
  const parts = resourceName.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

/** The segment immediately after a named key in a resource name. */
function segmentAfter(resourceName: string, key: string): string | null {
  const parts = resourceName.split("/").filter(Boolean);
  const index = parts.findIndex((p) => p === key);
  return index >= 0 && index + 1 < parts.length ? parts[index + 1] : null;
}

/**
 * Pulls the account/location/review/media identifiers out of any Google
 * resource name. `accounts/1/locations/2/reviews/3` -> ids 1, 2, 3.
 */
export function parseGoogleResourceName(
  resourceName: string | null | undefined,
): {
  accountId: string | null;
  locationId: string | null;
  reviewId: string | null;
  mediaId: string | null;
} {
  const name = typeof resourceName === "string" ? resourceName : "";
  return {
    accountId: segmentAfter(name, "accounts"),
    locationId: segmentAfter(name, "locations"),
    reviewId: segmentAfter(name, "reviews"),
    mediaId: segmentAfter(name, "media"),
  };
}

/** Uppercase + trim, tolerating a null/absent type. */
export function normalizeGoogleEventType(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

export function isSupportedEventType(
  type: string,
): type is GbpSupportedEventType {
  return SUPPORTED_SET.has(type);
}

export function isDeprecatedEventType(type: string): boolean {
  return DEPRECATED_SET.has(type);
}

/**
 * The shape of a Google Business Profile notification body. Only the fields the
 * router needs are typed; unknown fields are preserved by the caller's raw
 * payload copy.
 */
export type GbpNotificationPayload = {
  name?: string;
  notificationType?: string;
  accountName?: string;
  locationName?: string;
  reviewName?: string;
  newReview?: { name?: string };
  oldReview?: { name?: string };
  newMediaItem?: { name?: string };
  oldMediaItem?: { name?: string };
  voiceOfMerchantState?: unknown;
  [key: string]: unknown;
};

const MAX_RESOURCE_NAME_LENGTH = 512;

function readResourceName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_RESOURCE_NAME_LENGTH) return null;
  return trimmed;
}

/**
 * Normalizes one Google notification into the event DARB stores.
 *
 * Throws `GoogleEventParseError` only for a payload that cannot be an event at
 * all (missing type). A payload naming no location is still parsed — the router
 * records it as UNKNOWN_LOCATION and alerts Admin rather than guessing.
 */
export function classifyGoogleBusinessEvent(
  payload: unknown,
): GoogleBusinessEvent {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new GoogleEventParseError(
      "INVALID_EVENT",
      "Notification payload must be an object",
    );
  }
  const p = payload as GbpNotificationPayload;

  const rawType = normalizeGoogleEventType(p.notificationType ?? p.type);
  if (!rawType) {
    throw new GoogleEventParseError(
      "INVALID_EVENT",
      "Notification is missing notificationType",
    );
  }

  const deprecated = isDeprecatedEventType(rawType);
  const supported = isSupportedEventType(rawType);
  const eventType: GbpEventClassification = supported ? rawType : "UNKNOWN";

  // Location may arrive directly, or only inside a review/media resource name.
  const reviewResource =
    readResourceName(p.reviewName) ?? readResourceName(p.newReview?.name);
  const mediaResource =
    readResourceName(p.newMediaItem?.name) ??
    readResourceName(p.oldMediaItem?.name);
  const locationResource = readResourceName(p.locationName);

  const fromLocation = parseGoogleResourceName(locationResource);
  const fromReview = parseGoogleResourceName(reviewResource);
  const fromMedia = parseGoogleResourceName(mediaResource);

  const locationId =
    fromLocation.locationId ??
    fromReview.locationId ??
    fromMedia.locationId ??
    null;
  const accountId =
    parseGoogleResourceName(readResourceName(p.accountName)).accountId ??
    fromLocation.accountId ??
    fromReview.accountId ??
    fromMedia.accountId ??
    null;

  return {
    eventType,
    rawType,
    googleAccountId: accountId,
    googleLocationId: locationId,
    googleResourceName: locationResource,
    googleReviewId: fromReview.reviewId ?? fromMedia.reviewId ?? null,
    googleMediaId: fromMedia.mediaId ?? null,
    googleEventId: readResourceName(p.name),
    deprecated,
    supported,
  };
}

/** The sync job a supported event queues. */
export function eventSyncType(
  eventType: GbpEventClassification,
): "REVIEWS" | "MEDIA" | "PROFILE" | "HEALTH" | null {
  switch (eventType) {
    case "NEW_REVIEW":
    case "UPDATED_REVIEW":
      return "REVIEWS";
    case "NEW_CUSTOMER_MEDIA":
      return "MEDIA";
    case "GOOGLE_UPDATE":
      return "PROFILE";
    case "UPDATED_LOCATION_STATE":
    case "DUPLICATE_LOCATION":
    case "VOICE_OF_MERCHANT_UPDATED":
      return "HEALTH";
    default:
      return null;
  }
}

/** The queue priority for a supported event. */
export function eventPriority(
  eventType: GbpEventClassification,
): "CRITICAL" | "HIGH" | "NORMAL" | "LOW" | null {
  switch (eventType) {
    case "VOICE_OF_MERCHANT_UPDATED":
      return "CRITICAL";
    case "NEW_REVIEW":
    case "UPDATED_REVIEW":
    case "GOOGLE_UPDATE":
    case "UPDATED_LOCATION_STATE":
    case "DUPLICATE_LOCATION":
      return "HIGH";
    case "NEW_CUSTOMER_MEDIA":
      return "NORMAL";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Pub/Sub push envelope
// ---------------------------------------------------------------------------

export type PubSubPushEnvelope = {
  messageId: string;
  publishTime: string | null;
  attributes: Record<string, string>;
  /** The decoded JSON body of `message.data`. */
  data: unknown;
};

function decodeBase64Utf8(value: string): string {
  // atob + TextDecoder works in Node >= 18, Deno, and browsers alike.
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Validates and decodes a Pub/Sub push request body.
 *
 * Authentication (the OIDC token) is verified by the webhook before this runs;
 * this only rejects a structurally invalid envelope.
 */
export function decodePubSubEnvelope(body: unknown): PubSubPushEnvelope {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new GoogleEventParseError(
      "INVALID_ENVELOPE",
      "Push body must be an object",
    );
  }
  const message = (body as { message?: unknown }).message;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new GoogleEventParseError(
      "INVALID_ENVELOPE",
      "Push body is missing message",
    );
  }
  const m = message as {
    data?: unknown;
    messageId?: unknown;
    publishTime?: unknown;
    attributes?: unknown;
  };

  const messageId = typeof m.messageId === "string" ? m.messageId.trim() : "";
  if (!messageId) {
    throw new GoogleEventParseError(
      "INVALID_ENVELOPE",
      "Push message is missing messageId",
    );
  }

  if (typeof m.data !== "string" || !m.data) {
    throw new GoogleEventParseError(
      "INVALID_ENVELOPE",
      "Push message is missing data",
    );
  }

  let decoded: string;
  try {
    decoded = decodeBase64Utf8(m.data);
  } catch {
    throw new GoogleEventParseError(
      "INVALID_ENVELOPE",
      "Push message data is not valid base64",
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(decoded);
  } catch {
    throw new GoogleEventParseError(
      "INVALID_EVENT",
      "Push message data is not valid JSON",
    );
  }

  const attributes: Record<string, string> = {};
  if (
    m.attributes &&
    typeof m.attributes === "object" &&
    !Array.isArray(m.attributes)
  ) {
    for (const [k, v] of Object.entries(
      m.attributes as Record<string, unknown>,
    )) {
      if (typeof v === "string") attributes[k] = v;
    }
  }

  return {
    messageId,
    publishTime: typeof m.publishTime === "string" ? m.publishTime : null,
    attributes,
    data,
  };
}

// ---------------------------------------------------------------------------
// Payload hashing
// ---------------------------------------------------------------------------

/**
 * Deterministic JSON with sorted keys, so the same logical payload always hashes
 * the same regardless of key order.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** The canonical string that gets hashed: the classified event, not the envelope. */
export function payloadHashInput(event: GoogleBusinessEvent): string {
  return stableStringify({
    eventType: event.eventType,
    rawType: event.rawType,
    accountId: event.googleAccountId,
    locationId: event.googleLocationId,
    reviewId: event.googleReviewId,
    mediaId: event.googleMediaId,
    eventId: event.googleEventId,
  });
}

/** SHA-256 hex digest. Uses Web Crypto so it runs on the server runtime. */
export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
