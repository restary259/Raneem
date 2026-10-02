import { describe, expect, it, vi } from "vitest";
import {
  buildGbpMediaCreateBody,
  buildGbpPostBody,
  DARB_TO_GOOGLE_MEDIA_CATEGORY,
  darbMediaCategoryFor,
  GbpError,
  gbpPost,
  gbpUploadBytes,
  googleMediaCategoryFor,
  isCustomerMedia,
  isHttpsUrl,
  mediaItemPath,
  mediaPath,
  mediaStartUploadPath,
  normalizeGbpMedia,
  normalizeGbpPost,
  postCreatePath,
  postItemPath,
  postsPath,
  sniffImageMime,
  validateGbpPostDraft,
  validateMediaBytes,
  validateMediaDimensions,
  validateMediaFile,
  type GbpPostDraft,
} from "./googleBusinessGateway";

const creds = { lovableKey: "l", connectionKey: "c" };
const noSleep = () => Promise.resolve();

const jpegBytes = () =>
  new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const pngBytes = () =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe("sniffImageMime", () => {
  it("recognises real image magic bytes", () => {
    expect(sniffImageMime(jpegBytes())).toBe("image/jpeg");
    expect(sniffImageMime(pngBytes())).toBe("image/png");
    expect(
      sniffImageMime(
        new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]),
      ),
    ).toBe("image/gif");
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(sniffImageMime(webp)).toBe("image/webp");
  });

  it("rejects a spoofed extension and a too-short payload", () => {
    // "photo.jpg" containing a PDF header.
    const pdf = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0, 0, 0, 0,
    ]);
    expect(sniffImageMime(pdf)).toBeNull();
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("validateMediaBytes", () => {
  it("accepts matching bytes and rejects a MIME mismatch", () => {
    expect(validateMediaBytes(jpegBytes(), "image/jpeg").code).toBeNull();
    // The browser claims PNG but the bytes are JPEG: reject rather than trust.
    expect(validateMediaBytes(jpegBytes(), "image/png").code).toBe("bad_type");
  });

  it("rejects empty and oversized payloads", () => {
    expect(validateMediaBytes(new Uint8Array(0)).code).toBe("empty");
    const big = new Uint8Array(11 * 1024 * 1024);
    big.set([0xff, 0xd8, 0xff], 0);
    expect(validateMediaBytes(big).code).toBe("too_large");
  });
});

describe("media validation (client affordance)", () => {
  it("flags size and type problems", () => {
    expect(validateMediaFile({ size: 0, type: "image/jpeg" })).toBe("empty");
    expect(
      validateMediaFile({ size: 20 * 1024 * 1024, type: "image/jpeg" }),
    ).toBe("too_large");
    expect(validateMediaFile({ size: 100, type: "application/pdf" })).toBe(
      "bad_type",
    );
    expect(validateMediaFile({ size: 100, type: "image/jpeg" })).toBeNull();
  });

  it("flags undersized dimensions", () => {
    expect(validateMediaDimensions(100, 100)).toBe("too_small");
    expect(validateMediaDimensions(800, 600)).toBeNull();
  });
});

describe("DARB -> Google media category mapping", () => {
  it("maps each friendly label to a Google enum and never sends the DARB word", () => {
    expect(googleMediaCategoryFor("team")).toBe("TEAM");
    expect(googleMediaCategoryFor("cover")).toBe("COVER");
    expect(googleMediaCategoryFor("other")).toBe("ADDITIONAL");
    expect(googleMediaCategoryFor(null)).toBe("ADDITIONAL");
    // The DARB label "Team" is never itself a Google category value.
    expect(Object.values(DARB_TO_GOOGLE_MEDIA_CATEGORY)).not.toContain("Team");
  });

  it("maps a Google category back to a DARB label", () => {
    expect(darbMediaCategoryFor("COVER")).toBe("cover");
    expect(darbMediaCategoryFor("ADDITIONAL")).toBe("other");
    expect(darbMediaCategoryFor(undefined)).toBe("other");
  });
});

describe("buildGbpMediaCreateBody", () => {
  it("sends only the mapped Google category and the byte data ref", () => {
    const body = buildGbpMediaCreateBody({
      googleCategory: "INTERIOR",
      dataRefResourceName: "upload/abc",
      description: "Lobby",
    });
    expect(body).toEqual({
      mediaFormat: "PHOTO",
      locationAssociation: { category: "INTERIOR" },
      description: "Lobby",
      dataRef: { resourceName: "upload/abc" },
    });
    expect(JSON.stringify(body)).not.toContain("Interior");
  });
});

describe("normalizeGbpMedia", () => {
  it("keys the media by the last resource-name segment and keeps both categories", () => {
    const row = normalizeGbpMedia(
      {
        name: "accounts/1/locations/2/media/3",
        mediaFormat: "PHOTO",
        locationAssociation: { category: "TEAM" },
        googleUrl: "https://lh3.google/3",
        googleUrlThumbnail: "https://lh3.google/3=t",
        dimensions: { widthPixels: 1200, heightPixels: 800 },
        attribution: { profileName: "DARB" },
      },
      { locationId: "2" },
    );
    expect(row).not.toBeNull();
    expect(row!.google_media_id).toBe("3");
    expect(row!.media_category).toBe("TEAM");
    expect(row!.darb_category).toBe("team");
    expect(row!.media_origin).toBe("BUSINESS");
    expect(row!.width).toBe(1200);
    expect(row!.google_thumbnail_url).toBe("https://lh3.google/3=t");
  });

  it("separates customer media and drops unkeyable items", () => {
    const customer = normalizeGbpMedia(
      {
        name: "accounts/1/locations/2/media/9",
        mediaItemType: "CUSTOMER_MEDIA",
        googleUrl: "https://lh3.google/9",
      },
      { locationId: "2" },
    );
    expect(customer!.media_origin).toBe("CUSTOMER");
    expect(isCustomerMedia({ mediaItemType: "CUSTOMER" })).toBe(true);
    expect(isCustomerMedia({})).toBe(false);
    expect(normalizeGbpMedia({}, { locationId: "2" })).toBeNull();
  });
});

describe("media gateway paths", () => {
  it("builds list, item and byte-upload paths", () => {
    expect(mediaPath("1", "2")).toContain(
      "/accounts/1/locations/2/media?pageSize=100",
    );
    expect(mediaPath("1", "2", "tok")).toContain("pageToken=tok");
    expect(mediaItemPath("1", "2", "3")).toContain("/media/3");
    expect(mediaStartUploadPath("1", "2")).toContain("/media:startUpload");
  });
});

describe("gbpPost / gbpUploadBytes retry policy", () => {
  it("does not retry a create on a 5xx (a replay could double-create)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "boom" } }), {
        status: 500,
      }),
    );
    await expect(
      gbpPost("/x", {}, creds, fetchImpl as never, noSleep),
    ).rejects.toBeInstanceOf(GbpError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a create on a network failure (the request may have been applied)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await expect(
      gbpPost("/x", {}, creds, fetchImpl as never, noSleep),
    ).rejects.toBeInstanceOf(GbpError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a byte upload on a network failure", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await expect(
      gbpUploadBytes(
        "/u",
        jpegBytes(),
        "image/jpeg",
        creds,
        fetchImpl as never,
        noSleep,
      ),
    ).rejects.toBeInstanceOf(GbpError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries an upload once on 429 but not on 500", async () => {
    const rateLimited = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    await expect(
      gbpUploadBytes(
        "/u",
        jpegBytes(),
        "image/jpeg",
        creds,
        rateLimited as never,
        noSleep,
      ),
    ).resolves.toEqual({ ok: true });
    expect(rateLimited).toHaveBeenCalledTimes(2);

    const server = vi
      .fn()
      .mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(
      gbpUploadBytes(
        "/u",
        jpegBytes(),
        "image/jpeg",
        creds,
        server as never,
        noSleep,
      ),
    ).rejects.toBeInstanceOf(GbpError);
    expect(server).toHaveBeenCalledTimes(1);
  });
});

describe("normalizeGbpPost", () => {
  it("infers the topic type from Google's own fields", () => {
    const event = normalizeGbpPost({
      name: "accounts/1/locations/2/localPosts/7",
      summary: "Intake",
      event: {
        title: "German intake",
        schedule: {
          startDate: { year: 2026, month: 10, day: 10 },
          startTime: { hours: 18, minutes: 0 },
          endDate: { year: 2026, month: 10, day: 10 },
          endTime: { hours: 20, minutes: 0 },
        },
      },
    });
    expect(event!.topic_type).toBe("EVENT");
    expect(event!.google_post_id).toBe("7");
    expect(event!.event_start).toBe("2026-10-10T18:00");
    expect(event!.event_end).toBe("2026-10-10T20:00");

    const offer = normalizeGbpPost({
      name: "accounts/1/locations/2/localPosts/8",
      offer: { couponCode: "DARB10", redeemOnlineUrl: "https://darb.agency" },
    });
    expect(offer!.topic_type).toBe("OFFER");
    expect(offer!.offer_coupon_code).toBe("DARB10");

    const update = normalizeGbpPost({
      name: "accounts/1/locations/2/localPosts/9",
      callToAction: {
        actionType: "LEARN_MORE",
        url: "https://darb.agency/apply",
      },
    });
    expect(update!.topic_type).toBe("STANDARD");
    expect(update!.cta_type).toBe("LEARN_MORE");
    expect(normalizeGbpPost({})).toBeNull();
  });
});

describe("post gateway paths", () => {
  it("builds list, create and item paths on the v4 surface", () => {
    expect(postsPath("1", "2")).toContain("my_business/v4");
    expect(postsPath("1", "2")).toContain("/localPosts?pageSize=100");
    expect(postCreatePath("1", "2")).toMatch(/\/localPosts$/);
    expect(postItemPath("1", "2", "7")).toMatch(/\/localPosts\/7$/);
  });
});

describe("validateGbpPostDraft", () => {
  const base: GbpPostDraft = {
    topic_type: "STANDARD",
    language_code: "en",
    summary: "Applications are open.",
    cta_type: null,
    cta_url: null,
    event_title: null,
    event_start: null,
    event_end: null,
    offer_coupon_code: null,
    offer_url: null,
    offer_terms: null,
    media_ids: [],
  };

  it("requires content and a valid language", () => {
    expect(validateGbpPostDraft({ ...base, summary: "" })).toBe(
      "summary_required",
    );
    expect(validateGbpPostDraft({ ...base, language_code: "x" })).toBe(
      "language_invalid",
    );
    expect(validateGbpPostDraft(base)).toBeNull();
  });

  it("requires an HTTPS URL for link CTAs but not for CALL", () => {
    expect(validateGbpPostDraft({ ...base, cta_type: "LEARN_MORE" })).toBe(
      "cta_url_required",
    );
    expect(
      validateGbpPostDraft({
        ...base,
        cta_type: "LEARN_MORE",
        cta_url: "http://x.com",
      }),
    ).toBe("cta_url_not_https");
    expect(
      validateGbpPostDraft({
        ...base,
        cta_type: "LEARN_MORE",
        cta_url: "https://darb.agency/apply",
      }),
    ).toBeNull();
    expect(
      validateGbpPostDraft({
        ...base,
        cta_type: "CALL",
        cta_url: "https://x.com",
      }),
    ).toBe("cta_url_not_allowed");
    expect(validateGbpPostDraft({ ...base, cta_type: "CALL" })).toBeNull();
  });

  it("requires a coherent event window", () => {
    expect(
      validateGbpPostDraft({
        ...base,
        topic_type: "EVENT",
        event_title: "Intake",
        event_start: "2026-10-10T20:00",
        event_end: "2026-10-10T18:00",
      }),
    ).toBe("event_time_order");
    expect(
      validateGbpPostDraft({
        ...base,
        topic_type: "EVENT",
        event_title: "Intake",
        event_start: "2026-10-10T18:00",
        event_end: "2026-10-10T20:00",
      }),
    ).toBeNull();
  });

  it("requires offer details and an HTTPS redeem URL", () => {
    expect(validateGbpPostDraft({ ...base, topic_type: "OFFER" })).toBe(
      "offer_details_required",
    );
    expect(
      validateGbpPostDraft({
        ...base,
        topic_type: "OFFER",
        offer_coupon_code: "X",
        offer_url: "http://x.com",
      }),
    ).toBe("offer_url_not_https");
  });
});

describe("isHttpsUrl", () => {
  it("only accepts https", () => {
    expect(isHttpsUrl("https://darb.agency/apply")).toBe(true);
    expect(isHttpsUrl("http://darb.agency")).toBe(false);
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("buildGbpPostBody", () => {
  const draft: GbpPostDraft = {
    topic_type: "STANDARD",
    language_code: "de",
    summary: "  Applications open  ",
    cta_type: "LEARN_MORE",
    cta_url: "https://darb.agency/apply",
    event_title: null,
    event_start: null,
    event_end: null,
    offer_coupon_code: null,
    offer_url: null,
    offer_terms: null,
    media_ids: [],
  };

  it("carries the language, trimmed summary and CTA", () => {
    const body = buildGbpPostBody(draft, []);
    expect(body.languageCode).toBe("de");
    expect(body.summary).toBe("Applications open");
    expect(body.callToAction).toEqual({
      actionType: "LEARN_MORE",
      url: "https://darb.agency/apply",
    });
  });

  it("omits the CTA url for a CALL action", () => {
    const body = buildGbpPostBody(
      { ...draft, cta_type: "CALL", cta_url: null },
      [],
    );
    expect(body.callToAction).toEqual({ actionType: "CALL" });
  });

  it("supplies post media as URLs, never bytes", () => {
    const body = buildGbpPostBody(draft, [
      "https://cdn.darb.agency/google-posts/a.jpg",
    ]);
    expect(body.media).toEqual([
      {
        mediaFormat: "PHOTO",
        sourceUrl: "https://cdn.darb.agency/google-posts/a.jpg",
      },
    ]);
    expect(JSON.stringify(body)).not.toContain("dataRef");
  });

  it("builds an event schedule and offer payload", () => {
    const event = buildGbpPostBody(
      {
        ...draft,
        topic_type: "EVENT",
        cta_type: null,
        cta_url: null,
        event_title: "Intake",
        event_start: "2026-10-10T18:00",
        event_end: "2026-10-10T20:00",
      },
      [],
    );
    expect(event.topicType).toBe("EVENT");
    expect(event.event).toMatchObject({ title: "Intake" });

    const offer = buildGbpPostBody(
      {
        ...draft,
        topic_type: "OFFER",
        cta_type: null,
        cta_url: null,
        offer_coupon_code: "DARB10",
        offer_terms: "One per student",
      },
      [],
    );
    expect(offer.offer).toEqual({
      couponCode: "DARB10",
      termsConditions: "One per student",
    });
  });
});
