import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildGbpLocationPatch,
  byteLength,
  denormalizeGbpRegularHours,
  GbpError,
  gbpGet,
  invalidHoursDay,
  isWithinDescriptionLimit,
  isValidPhone,
  isValidWebsite,
  mapGbpError,
  normalizeGbpProfile,
  normalizeGbpRegularHours,
  normalizeGbpSpecialHours,
} from "./googleBusinessGateway";

const creds = { lovableKey: "l", connectionKey: "c" };
const noSleep = () => Promise.resolve();
const res = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers,
  });

describe("mapGbpError", () => {
  it("maps statuses and extracts Google message", () => {
    const e = mapGbpError(
      403,
      JSON.stringify({ error: { message: "API not enabled" } }),
    );
    expect(e.code).toBe("forbidden");
    expect(e.message).toBe("API not enabled");
    expect(mapGbpError(401, "x").code).toBe("unauthorized");
    expect(mapGbpError(429, "x").code).toBe("rate_limited");
    expect(mapGbpError(500, "x").code).toBe("upstream");
  });

  // Regression: a provider 400 (e.g. a bad readMask) must not be flattened into
  // the generic `upstream` bucket — that hid the real INVALID_ARGUMENT cause.
  it("classifies provider 4xx precisely instead of as upstream", () => {
    expect(mapGbpError(400, "x").code).toBe("invalid_request");
    expect(mapGbpError(404, "x").code).toBe("not_found");
    expect(mapGbpError(401, "x").code).toBe("unauthorized");
    expect(mapGbpError(403, "x").code).toBe("forbidden");
    expect(mapGbpError(429, "x").code).toBe("rate_limited");
    expect(mapGbpError(500, "x").code).toBe("upstream");
    expect(mapGbpError(503, "x").code).toBe("upstream");
  });
});

describe("gbpGet", () => {
  it("sends both gateway headers", async () => {
    const f = vi.fn().mockResolvedValue(res(200, { ok: 1 }));
    await gbpGet("/a", creds, f, noSleep);
    expect(f.mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer l",
      "X-Connection-Api-Key": "c",
    });
  });
  it("does not retry 4xx", async () => {
    const f = vi.fn().mockResolvedValue(res(403, "no"));
    await expect(gbpGet("/a", creds, f, noSleep)).rejects.toBeInstanceOf(
      GbpError,
    );
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("retries 429/5xx at most 3 times", async () => {
    const f = vi
      .fn()
      .mockImplementation(() => Promise.resolve(res(503, "busy")));
    await expect(gbpGet("/a", creds, f, noSleep)).rejects.toMatchObject({
      status: 503,
    });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("recovers after a 429 with Retry-After", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const f = vi
      .fn()
      .mockResolvedValueOnce(res(429, "slow", { "retry-after": "2" }))
      .mockResolvedValueOnce(res(200, { v: 1 }));
    await expect(gbpGet("/a", creds, f, sleep)).resolves.toEqual({ v: 1 });
    expect(sleep).toHaveBeenCalledWith(2000);
  });
});

// ---------------------------------------------------------------------------
// Phase 6 — profile normalization, patch building and validation
// ---------------------------------------------------------------------------

describe("normalizeGbpProfile", () => {
  it("maps Google's location resource into the DARB shape", () => {
    const out = normalizeGbpProfile({
      title: "DARB Berlin",
      profile: { description: "Study abroad help." },
      phoneNumbers: {
        primaryPhone: "+49 30 1",
        additionalPhones: ["+49 30 2", ""],
      },
      websiteUri: "https://darb.agency",
      categories: {
        primaryCategory: { displayName: "Educational consultant" },
        additionalCategories: [{ displayName: "Language school" }, {}],
      },
      storefrontAddress: {
        addressLines: ["Musterstraße 12", "2nd floor"],
        locality: "Berlin",
        administrativeArea: "Berlin",
        postalCode: "10115",
        regionCode: "DE",
      },
      latlng: { latitude: 52.53, longitude: 13.38 },
      locationState: { isVerified: true, isSuspended: false },
    });
    expect(out.business_name).toBe("DARB Berlin");
    expect(out.business_description).toBe("Study abroad help.");
    expect(out.primary_category).toBe("Educational consultant");
    expect(out.additional_categories).toEqual(["Language school"]);
    expect(out.phone_additional).toEqual(["+49 30 2"]);
    expect(out.address_line_1).toBe("Musterstraße 12");
    expect(out.address_line_2).toBe("2nd floor");
    expect(out.city).toBe("Berlin");
    expect(out.country).toBe("DE");
    expect(out.latitude).toBe(52.53);
    expect(out.google_state).toBe("OPEN");
    expect(out.verification_status).toBe("verified");
  });

  it("never invents values for an empty resource", () => {
    const out = normalizeGbpProfile({});
    expect(out.business_name).toBeNull();
    expect(out.additional_categories).toEqual([]);
    expect(out.special_hours).toEqual([]);
    expect(out.google_state).toBeNull();
    expect(out.verification_status).toBeNull();
  });

  it("flags a suspended location", () => {
    expect(
      normalizeGbpProfile({ locationState: { isSuspended: true } })
        .google_state,
    ).toBe("SUSPENDED");
  });
});

describe("regular hours round-trip", () => {
  it("reads Google periods into a weekday map", () => {
    const hours = normalizeGbpRegularHours({
      periods: [
        {
          openDay: "MONDAY",
          openTime: { hours: 9, minutes: 0 },
          closeDay: "MONDAY",
          closeTime: { hours: 17, minutes: 30 },
        },
        {
          openDay: "MONDAY",
          openTime: { hours: 18 },
          closeDay: "MONDAY",
          closeTime: { hours: 20 },
        },
        {
          openDay: "SUNDAY",
          openTime: { hours: 10 },
          closeDay: "SUNDAY",
          closeTime: { hours: 14 },
        },
      ],
    });
    expect(hours?.MONDAY).toEqual([
      { open: "09:00", close: "17:30" },
      { open: "18:00", close: "20:00" },
    ]);
    expect(hours?.SUNDAY).toEqual([{ open: "10:00", close: "14:00" }]);
  });

  it("returns null rather than a fabricated week", () => {
    expect(normalizeGbpRegularHours(undefined)).toBeNull();
    expect(normalizeGbpRegularHours({ periods: [] })).toBeNull();
  });

  it("writes a weekday map back into Google periods in week order", () => {
    const out = denormalizeGbpRegularHours({
      MONDAY: [{ open: "09:00", close: "17:00" }],
      SUNDAY: null,
    });
    expect(out?.periods).toEqual([
      {
        openDay: "MONDAY",
        openTime: { hours: 9, minutes: 0 },
        closeDay: "MONDAY",
        closeTime: { hours: 17, minutes: 0 },
      },
    ]);
  });
});

describe("special hours", () => {
  it("reads closed and open periods", () => {
    const out = normalizeGbpSpecialHours({
      specialHourPeriods: [
        { startDate: { year: 2026, month: 12, day: 25 }, closed: true },
        {
          startDate: { year: 2026, month: 12, day: 31 },
          openTime: { hours: 10, minutes: 0 },
          closeTime: { hours: 14, minutes: 0 },
        },
        { startDate: { year: 2026 } },
      ],
    });
    expect(out).toEqual([
      { date: "2026-12-25", closed: true },
      {
        date: "2026-12-31",
        closed: false,
        periods: [{ open: "10:00", close: "14:00" }],
      },
    ]);
  });
});

describe("buildGbpLocationPatch", () => {
  it("builds a mask for only the fields that changed", () => {
    const out = buildGbpLocationPatch({
      phone_primary: "+49 30 1",
      website_url: "https://a.de",
    });
    expect(out.updateMask.split(",").sort()).toEqual([
      "phoneNumbers.primaryPhone",
      "websiteUri",
    ]);
    expect(out.body.phoneNumbers?.primaryPhone).toBe("+49 30 1");
    expect(out.body.title).toBeUndefined();
  });

  it("merges address lines into a single array and one mask entry", () => {
    const out = buildGbpLocationPatch({
      address_line_1: "A 1",
      address_line_2: "",
      city: "Berlin",
    });
    expect(out.body.storefrontAddress?.addressLines).toEqual(["A 1"]);
    expect(out.body.storefrontAddress?.locality).toBe("Berlin");
    expect(
      out.updateMask
        .split(",")
        .filter((p) => p === "storefrontAddress.addressLines"),
    ).toHaveLength(1);
  });

  it("collapses latitude/longitude into one latlng mask", () => {
    const out = buildGbpLocationPatch({ latitude: 1, longitude: 2 });
    expect(out.body.latlng).toEqual({ latitude: 1, longitude: 2 });
    expect(out.updateMask).toBe("latlng");
  });

  it("encodes categories and hours", () => {
    const out = buildGbpLocationPatch({
      primary_category: "Language school",
      additional_categories: ["A", "B"],
      regular_hours: { MONDAY: [{ open: "09:00", close: "17:00" }] },
    });
    expect(out.body.categories?.primaryCategory).toEqual({
      displayName: "Language school",
    });
    expect(out.body.categories?.additionalCategories).toEqual([
      { displayName: "A" },
      { displayName: "B" },
    ]);
    expect(out.body.regularHours?.periods).toHaveLength(1);
    expect(out.updateMask).toContain("regularHours");
  });

  it("returns an empty mask when nothing is publishable", () => {
    expect(buildGbpLocationPatch({}).updateMask).toBe("");
  });
});

describe("client validation mirrors the server", () => {
  it("accepts and rejects phone numbers", () => {
    expect(isValidPhone("+49 30 123456")).toBe(true);
    expect(isValidPhone("abc123")).toBe(false);
    expect(isValidPhone("12345")).toBe(false);
  });

  it("requires https and rejects script URLs", () => {
    expect(isValidWebsite("https://darb.agency")).toBe(true);
    expect(isValidWebsite("http://darb.agency")).toBe(false);
    expect(isValidWebsite("javascript:alert(1)")).toBe(false);
  });

  it("counts UTF-8 bytes, not characters", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("ممم")).toBe(6);
    expect(isWithinDescriptionLimit("م".repeat(400))).toBe(false);
  });

  it("detects invalid hours", () => {
    expect(
      invalidHoursDay({ MONDAY: [{ open: "09:00", close: "17:00" }] }),
    ).toBeNull();
    expect(
      invalidHoursDay({ FUNDAY: [{ open: "09:00", close: "17:00" }] } as never),
    ).toBe("FUNDAY");
    expect(
      invalidHoursDay({ MONDAY: [{ open: "25:00", close: "17:00" }] }),
    ).toBe("MONDAY");
    expect(
      invalidHoursDay({ MONDAY: [{ open: "17:00", close: "09:00" }] }),
    ).toBe("MONDAY");
    expect(invalidHoursDay({ SUNDAY: null })).toBeNull();
  });
});

// The connection panel renders `admin.googleConnection.errors.${code}` for any
// error code, so every code this module can emit needs a translation in each
// locale — otherwise the user sees a raw key path instead of a message.
describe("googleConnection error-code translations", () => {
  const LOCALES = ["en", "ar", "he"] as const;
  const CODES = [
    "not_linked",
    "unauthorized",
    "forbidden",
    "invalid_request",
    "not_found",
    "rate_limited",
    "upstream",
    "network",
    "internal",
  ] as const;

  it.each(LOCALES)("has every error code translated in %s", (lang) => {
    const file = path.join(
      process.cwd(),
      "public",
      "locales",
      lang,
      "dashboard.json",
    );
    const dict = JSON.parse(fs.readFileSync(file, "utf8"));
    const errors = dict?.admin?.googleConnection?.errors;
    expect(errors, `${lang} googleConnection.errors missing`).toBeTruthy();
    for (const code of CODES) {
      expect(typeof errors[code], `${lang} missing ${code}`).toBe("string");
      expect(errors[code].length, `${lang} empty ${code}`).toBeGreaterThan(0);
    }
  });
});

