import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  isLinkablePhone,
  whatsappUrl,
  toE164,
  telHref,
  formatPhoneDisplay,
} from "./phone";

describe("normalizePhone", () => {
  it("converts local Israeli numbers to the international form", () => {
    expect(normalizePhone("054-123-4567")).toBe("972541234567");
    expect(normalizePhone("00972541234567")).toBe("972541234567");
    expect(normalizePhone("+972 54 123 4567")).toBe("972541234567");
  });

  it("leaves other international numbers untouched", () => {
    expect(normalizePhone("+49 151 23456789")).toBe("4915123456789");
  });

  it("returns an empty string when there are no digits", () => {
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone(undefined)).toBe("");
    expect(normalizePhone("n/a")).toBe("");
  });
});

describe("isLinkablePhone", () => {
  it("accepts numbers of 9 to 15 digits", () => {
    expect(isLinkablePhone("054-123-4567")).toBe(true);
    expect(isLinkablePhone("123456789")).toBe(true);
    expect(isLinkablePhone("123456789012345")).toBe(true);
  });

  it("rejects too short and too long numbers", () => {
    expect(isLinkablePhone("12345678")).toBe(false);
    expect(isLinkablePhone("1234567890123456")).toBe(false);
    expect(isLinkablePhone("")).toBe(false);
  });
});

describe("whatsappUrl", () => {
  it("builds a wa.me link from the normalised number", () => {
    expect(whatsappUrl("054-123-4567")).toBe("https://wa.me/972541234567");
  });

  it("returns null for unusable numbers", () => {
    expect(whatsappUrl("0541")).toBeNull();
    expect(whatsappUrl(null)).toBeNull();
  });
});

describe("toE164", () => {
  it("applies the office country code to a national number", () => {
    expect(toE164("06221 123456", "DE")).toBe("+496221123456");
    expect(toE164("054-123-4567", "IL")).toBe("+972541234567");
  });

  it("never assumes Israel for a national number without a country", () => {
    expect(toE164("054-123-4567")).toBe("0541234567");
  });

  it("keeps already-international input as-is regardless of country", () => {
    expect(toE164("+49 151 23456789", "IL")).toBe("+4915123456789");
    expect(toE164("0049 151 23456789", "IL")).toBe("+4915123456789");
  });

  it("returns an empty string when there is no number", () => {
    expect(toE164(null, "DE")).toBe("");
    expect(toE164("  ", "DE")).toBe("");
  });
});

describe("telHref", () => {
  it("builds a country-aware tel link", () => {
    expect(telHref("06221 123456", "DE")).toBe("tel:+496221123456");
    expect(telHref("+972-54-123-4567", "DE")).toBe("tel:+972541234567");
  });

  it("returns an empty string for a missing number", () => {
    expect(telHref(null, "DE")).toBe("");
  });
});

describe("formatPhoneDisplay", () => {
  it("preserves author formatting for international input", () => {
    expect(formatPhoneDisplay("+49 151 23456789", "DE")).toBe(
      "+49 151 23456789",
    );
  });

  it("normalises a national number using the country", () => {
    expect(formatPhoneDisplay("054-123-4567", "IL")).toBe("+972541234567");
  });
});
