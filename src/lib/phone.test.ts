import { describe, it, expect } from "vitest";
import { normalizePhone, isLinkablePhone, whatsappUrl } from "./phone";

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
