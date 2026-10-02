import { describe, expect, it } from "vitest";
import {
  GBP_DEPRECATED_EVENT_TYPES,
  GBP_SUPPORTED_EVENT_TYPES,
  GoogleEventParseError,
  classifyGoogleBusinessEvent,
  decodePubSubEnvelope,
  eventPriority,
  eventSyncType,
  isDeprecatedEventType,
  isSupportedEventType,
  lastResourceSegment,
  normalizeGoogleEventType,
  parseGoogleResourceName,
  payloadHashInput,
  sha256Hex,
  stableStringify,
} from "@/lib/googleBusinessEvents";

function encodeData(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

describe("event type sets", () => {
  it("subscribes to the current Google notification types", () => {
    expect([...GBP_SUPPORTED_EVENT_TYPES].sort()).toEqual(
      [
        "DUPLICATE_LOCATION",
        "GOOGLE_UPDATE",
        "NEW_CUSTOMER_MEDIA",
        "NEW_REVIEW",
        "UPDATED_LOCATION_STATE",
        "UPDATED_REVIEW",
        "VOICE_OF_MERCHANT_UPDATED",
      ].sort(),
    );
  });

  it("treats the retired Q&A types and legacy VOM as deprecated, not supported", () => {
    for (const t of GBP_DEPRECATED_EVENT_TYPES) {
      expect(isDeprecatedEventType(t)).toBe(true);
      expect(isSupportedEventType(t)).toBe(false);
    }
    expect(isDeprecatedEventType("LOSS_OF_VOICE_OF_MERCHANT")).toBe(true);
    expect(isSupportedEventType("VOICE_OF_MERCHANT_UPDATED")).toBe(true);
  });
});

describe("parseGoogleResourceName", () => {
  it("extracts ids from a full review resource name", () => {
    expect(parseGoogleResourceName("accounts/1/locations/2/reviews/3")).toEqual(
      { accountId: "1", locationId: "2", reviewId: "3", mediaId: null },
    );
  });

  it("extracts media ids", () => {
    expect(parseGoogleResourceName("accounts/1/locations/2/media/9")).toEqual({
      accountId: "1",
      locationId: "2",
      reviewId: null,
      mediaId: "9",
    });
  });

  it("returns nulls for an empty or malformed name", () => {
    expect(parseGoogleResourceName(null)).toEqual({
      accountId: null,
      locationId: null,
      reviewId: null,
      mediaId: null,
    });
    expect(lastResourceSegment("accounts/1/locations/2")).toBe("2");
    expect(lastResourceSegment("")).toBeNull();
  });
});

describe("classifyGoogleBusinessEvent", () => {
  it("classifies NEW_REVIEW and keeps the location id, not the name", () => {
    const e = classifyGoogleBusinessEvent({
      name: "accounts/1/notifications/n1",
      notificationType: "NEW_REVIEW",
      locationName: "accounts/1/locations/12345",
      reviewName: "accounts/1/locations/12345/reviews/999",
    });
    expect(e.eventType).toBe("NEW_REVIEW");
    expect(e.googleLocationId).toBe("12345");
    expect(e.googleReviewId).toBe("999");
    expect(e.googleAccountId).toBe("1");
    expect(e.supported).toBe(true);
    expect(e.deprecated).toBe(false);
  });

  it("normalizes a lower-case type", () => {
    const e = classifyGoogleBusinessEvent({
      notificationType: "new_review",
      locationName: "accounts/1/locations/5",
    });
    expect(e.eventType).toBe("NEW_REVIEW");
    expect(e.rawType).toBe("NEW_REVIEW");
  });

  it("falls back to the review resource when locationName is absent", () => {
    const e = classifyGoogleBusinessEvent({
      notificationType: "UPDATED_REVIEW",
      newReview: { name: "accounts/7/locations/42/reviews/8" },
    });
    expect(e.googleLocationId).toBe("42");
    expect(e.googleAccountId).toBe("7");
    expect(e.googleReviewId).toBe("8");
  });

  it("classifies an unknown future type as UNKNOWN instead of throwing", () => {
    const e = classifyGoogleBusinessEvent({
      notificationType: "SOMETHING_BRAND_NEW",
      locationName: "accounts/1/locations/5",
    });
    expect(e.eventType).toBe("UNKNOWN");
    expect(e.supported).toBe(false);
    expect(e.googleLocationId).toBe("5");
  });

  it("marks a deprecated Q&A event and never treats it as supported", () => {
    const e = classifyGoogleBusinessEvent({
      notificationType: "NEW_QUESTION",
      locationName: "accounts/1/locations/5",
    });
    expect(e.deprecated).toBe(true);
    expect(e.eventType).toBe("UNKNOWN");
  });

  it("still parses an event that names no location (router handles UNKNOWN_LOCATION)", () => {
    const e = classifyGoogleBusinessEvent({
      notificationType: "GOOGLE_UPDATE",
    });
    expect(e.eventType).toBe("GOOGLE_UPDATE");
    expect(e.googleLocationId).toBeNull();
  });

  it("throws INVALID_EVENT when the type is missing", () => {
    expect(() =>
      classifyGoogleBusinessEvent({ locationName: "accounts/1/locations/5" }),
    ).toThrow(GoogleEventParseError);
  });

  it("throws INVALID_EVENT for a non-object payload", () => {
    expect(() => classifyGoogleBusinessEvent("nope")).toThrow(
      GoogleEventParseError,
    );
    expect(() => classifyGoogleBusinessEvent([])).toThrow(
      GoogleEventParseError,
    );
  });

  it("ignores an over-long resource name rather than storing it", () => {
    const e = classifyGoogleBusinessEvent({
      notificationType: "NEW_REVIEW",
      locationName: `accounts/1/locations/${"9".repeat(600)}`,
    });
    expect(e.googleLocationId).toBeNull();
  });
});

describe("event routing tables", () => {
  it("maps each supported event to its sync type and priority", () => {
    expect(eventSyncType("NEW_REVIEW")).toBe("REVIEWS");
    expect(eventPriority("NEW_REVIEW")).toBe("HIGH");
    expect(eventSyncType("NEW_CUSTOMER_MEDIA")).toBe("MEDIA");
    expect(eventPriority("NEW_CUSTOMER_MEDIA")).toBe("NORMAL");
    expect(eventSyncType("GOOGLE_UPDATE")).toBe("PROFILE");
    expect(eventSyncType("UPDATED_LOCATION_STATE")).toBe("HEALTH");
    expect(eventSyncType("DUPLICATE_LOCATION")).toBe("HEALTH");
    expect(eventSyncType("VOICE_OF_MERCHANT_UPDATED")).toBe("HEALTH");
    expect(eventPriority("VOICE_OF_MERCHANT_UPDATED")).toBe("CRITICAL");
  });

  it("returns no job for an unknown type", () => {
    expect(eventSyncType("UNKNOWN")).toBeNull();
    expect(eventPriority("UNKNOWN")).toBeNull();
  });
});

describe("decodePubSubEnvelope", () => {
  it("decodes a valid push envelope", () => {
    const env = decodePubSubEnvelope({
      message: {
        messageId: "m-1",
        publishTime: "2026-10-02T12:00:00Z",
        attributes: { notificationType: "NEW_REVIEW" },
        data: encodeData({
          notificationType: "NEW_REVIEW",
          locationName: "accounts/1/locations/2",
        }),
      },
    });
    expect(env.messageId).toBe("m-1");
    expect(env.attributes.notificationType).toBe("NEW_REVIEW");
    expect((env.data as { locationName: string }).locationName).toBe(
      "accounts/1/locations/2",
    );
  });

  it("rejects a missing messageId", () => {
    expect(() =>
      decodePubSubEnvelope({
        message: { data: encodeData({ notificationType: "NEW_REVIEW" }) },
      }),
    ).toThrow(GoogleEventParseError);
  });

  it("rejects a missing data field", () => {
    expect(() =>
      decodePubSubEnvelope({ message: { messageId: "m-1" } }),
    ).toThrow(GoogleEventParseError);
  });

  it("rejects non-JSON data", () => {
    expect(() =>
      decodePubSubEnvelope({
        message: { messageId: "m-1", data: btoa("not json") },
      }),
    ).toThrow(GoogleEventParseError);
  });

  it("rejects a body with no message", () => {
    expect(() => decodePubSubEnvelope({})).toThrow(GoogleEventParseError);
    expect(() => decodePubSubEnvelope(null)).toThrow(GoogleEventParseError);
  });

  it("drops non-string attributes instead of trusting them", () => {
    const env = decodePubSubEnvelope({
      message: {
        messageId: "m-1",
        data: encodeData({ notificationType: "NEW_REVIEW" }),
        attributes: { n: 1, s: "x" },
      },
    });
    expect(env.attributes).toEqual({ s: "x" });
  });
});

describe("payload hashing", () => {
  it("stableStringify is key-order independent", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(
      stableStringify({ a: 2, b: 1 }),
    );
  });

  it("payloadHashInput is identical for identical payloads", () => {
    const payload = {
      notificationType: "NEW_REVIEW",
      locationName: "accounts/1/locations/2",
      reviewName: "accounts/1/locations/2/reviews/3",
    };
    expect(payloadHashInput(classifyGoogleBusinessEvent(payload))).toBe(
      payloadHashInput(classifyGoogleBusinessEvent({ ...payload })),
    );
  });

  it("payloadHashInput changes when the notification itself changes", () => {
    const base = classifyGoogleBusinessEvent({
      notificationType: "NEW_REVIEW",
      locationName: "accounts/1/locations/2",
      reviewName: "accounts/1/locations/2/reviews/3",
    });
    const other = classifyGoogleBusinessEvent({
      name: "accounts/1/notifications/zzz",
      notificationType: "NEW_REVIEW",
      locationName: "accounts/1/locations/2",
      reviewName: "accounts/1/locations/2/reviews/3",
    });
    expect(payloadHashInput(base)).not.toBe(payloadHashInput(other));
  });

  it("hashes deterministically", async () => {
    const h1 = await sha256Hex(
      payloadHashInput(
        classifyGoogleBusinessEvent({
          notificationType: "NEW_REVIEW",
          locationName: "accounts/1/locations/2",
        }),
      ),
    );
    const h2 = await sha256Hex(
      payloadHashInput(
        classifyGoogleBusinessEvent({
          notificationType: "NEW_REVIEW",
          locationName: "accounts/1/locations/2",
        }),
      ),
    );
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("normalizeGoogleEventType", () => {
  it("trims and upper-cases, tolerating non-strings", () => {
    expect(normalizeGoogleEventType(" new_review ")).toBe("NEW_REVIEW");
    expect(normalizeGoogleEventType(null)).toBe("");
    expect(normalizeGoogleEventType(42)).toBe("");
  });
});
