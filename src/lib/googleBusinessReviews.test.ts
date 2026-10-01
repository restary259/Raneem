import { describe, expect, it, vi } from "vitest";
import {
  GBP_REPLY_MAX_BYTES,
  GbpError,
  gbpDelete,
  gbpPut,
  isValidReply,
  normalizeGbpReview,
  replyByteLength,
  reviewReplyPath,
  reviewsPath,
  starRatingToInt,
} from "./googleBusinessGateway";

const creds = { lovableKey: "l", connectionKey: "c" };
const noSleep = () => Promise.resolve();
const res = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Response(
    body === undefined
      ? null
      : typeof body === "string"
        ? body
        : JSON.stringify(body),
    {
      status,
      headers,
    },
  );

describe("starRatingToInt", () => {
  it("maps Google's enum", () => {
    expect(starRatingToInt("FIVE")).toBe(5);
    expect(starRatingToInt("ONE")).toBe(1);
    expect(starRatingToInt("five")).toBe(5);
  });
  it("returns null for unknown/empty", () => {
    expect(starRatingToInt("STAR_RATING_UNSPECIFIED")).toBeNull();
    expect(starRatingToInt(null)).toBeNull();
  });
});

describe("normalizeGbpReview", () => {
  const opts = { accountId: "acct-1", locationId: "loc-berlin" };

  it("normalizes a full review", () => {
    const row = normalizeGbpReview(
      {
        name: "accounts/acct-1/locations/loc-berlin/reviews/r1",
        reviewId: "r1",
        reviewer: { displayName: "Ahmed", profilePhotoUrl: "https://x/y.png" },
        starRating: "FIVE",
        comment: "Great service",
        createTime: "2026-09-01T10:00:00Z",
        updateTime: "2026-09-02T10:00:00Z",
      },
      opts,
    );
    expect(row).toMatchObject({
      google_review_id: "r1",
      reviewer_display_name: "Ahmed",
      reviewer_is_anonymous: false,
      star_rating: 5,
      comment: "Great service",
      reply_comment: null,
    });
  });

  it("never invents a name for an anonymous reviewer", () => {
    const row = normalizeGbpReview(
      {
        reviewId: "r2",
        reviewer: { isAnonymous: true, displayName: "Someone" },
        starRating: "ONE",
      },
      opts,
    );
    expect(row?.reviewer_display_name).toBeNull();
    expect(row?.reviewer_is_anonymous).toBe(true);
  });

  it("captures the reply and its rejection state", () => {
    const row = normalizeGbpReview(
      {
        reviewId: "r3",
        starRating: "THREE",
        reviewReply: {
          comment: "Sorry!",
          state: "REJECTED",
          policyViolation: "SPAM",
        },
      },
      opts,
    );
    expect(row?.reply_comment).toBe("Sorry!");
    expect(row?.reply_state).toBe("REJECTED");
    expect(row?.reply_policy_violation).toBe("SPAM");
  });

  it("skips a review with no id or an unusable rating", () => {
    expect(normalizeGbpReview({ starRating: "FIVE" }, opts)).toBeNull();
    expect(
      normalizeGbpReview({ reviewId: "r4", starRating: "NOPE" }, opts),
    ).toBeNull();
  });

  it("builds the resource name when Google omits it", () => {
    const row = normalizeGbpReview(
      { reviewId: "r5", starRating: "FOUR" },
      opts,
    );
    expect(row?.google_review_resource_name).toBe(
      "accounts/acct-1/locations/loc-berlin/reviews/r5",
    );
  });
});

describe("reply byte length", () => {
  it("counts bytes, not characters", () => {
    expect(replyByteLength("abc")).toBe(3);
    // Arabic is 2 bytes per char.
    expect(replyByteLength("ا")).toBe(2);
    // Emoji is 4 bytes.
    expect(replyByteLength("😀")).toBe(4);
  });

  it("accepts 4096 bytes and rejects 4097", () => {
    expect(isValidReply("a".repeat(GBP_REPLY_MAX_BYTES))).toBe(true);
    expect(isValidReply("a".repeat(GBP_REPLY_MAX_BYTES + 1))).toBe(false);
  });

  it("rejects an Arabic reply that is under the char limit but over the byte limit", () => {
    // 2049 Arabic chars = 4098 bytes: passes String.length, must fail bytes.
    const arabic = "ا".repeat(2049);
    expect(arabic.length).toBeLessThan(GBP_REPLY_MAX_BYTES);
    expect(isValidReply(arabic)).toBe(false);
  });

  it("rejects a blank reply", () => {
    expect(isValidReply("   ")).toBe(false);
  });
});

describe("paths", () => {
  it("targets the v4 reviews endpoint with pageSize 50", () => {
    const p = reviewsPath("acct-1", "loc-berlin");
    expect(p).toContain(
      "/mybusiness.googleapis.com/v4/accounts/acct-1/locations/loc-berlin/reviews",
    );
    expect(p).toContain("pageSize=50");
  });
  it("includes the page token when present", () => {
    expect(reviewsPath("a", "l", "TOK")).toContain("pageToken=TOK");
  });
  it("targets the reply sub-resource", () => {
    expect(reviewReplyPath("acct-1", "loc-berlin", "r1")).toBe(
      "/mybusiness.googleapis.com/v4/accounts/acct-1/locations/loc-berlin/reviews/r1/reply",
    );
  });
});

describe("gbpPut", () => {
  it("sends a JSON body with both gateway headers", async () => {
    const f = vi.fn().mockResolvedValue(res(200, { comment: "hi" }));
    await gbpPut("/a", { comment: "hi" }, creds, f, noSleep);
    const init = f.mock.calls[0][1];
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ comment: "hi" }));
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers.Authorization).toBe("Bearer l");
  });

  it("retries a 5xx (an absolute-value write is safe to replay)", async () => {
    const f = vi
      .fn()
      .mockImplementation(() => Promise.resolve(res(503, "busy")));
    await expect(gbpPut("/a", {}, creds, f, noSleep)).rejects.toBeInstanceOf(
      GbpError,
    );
    expect(f).toHaveBeenCalledTimes(3);
  });
});

describe("gbpDelete", () => {
  it("tolerates an empty 204 response", async () => {
    const f = vi.fn().mockResolvedValue(res(204, undefined));
    await expect(gbpDelete("/a", creds, f, noSleep)).resolves.toBeUndefined();
  });

  it("does NOT retry a 5xx (retrying a delete could hit an already-deleted reply)", async () => {
    const f = vi.fn().mockResolvedValue(res(503, "busy"));
    await expect(gbpDelete("/a", creds, f, noSleep)).rejects.toBeInstanceOf(
      GbpError,
    );
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("still retries a 429 (nothing was applied)", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(res(429, "slow"))
      .mockResolvedValueOnce(res(204, undefined));
    await expect(gbpDelete("/a", creds, f, noSleep)).resolves.toBeUndefined();
    expect(f).toHaveBeenCalledTimes(2);
  });
});
