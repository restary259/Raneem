import { describe, expect, it } from "vitest";
import {
  BRAND_NAME,
  BRAND_NAME_AR,
  color,
  CONTAINER_WIDTH,
  font,
  LOGO_URL,
  LOGO_WIDTH,
  radius,
  SITE_URL,
  SOCIAL_LINKS,
  SUPPORT_PHONE,
  SUPPORT_WHATSAPP_URL,
} from "./theme";

describe("email theme tokens", () => {
  it("uses the production site url for assets and links", () => {
    expect(SITE_URL).toBe("https://darb.agency");
    expect(LOGO_URL.startsWith(SITE_URL)).toBe(true);
    expect(LOGO_WIDTH).toBeGreaterThan(0);
    expect(CONTAINER_WIDTH).toBe(600);
  });

  it("names the brand in both languages", () => {
    expect(BRAND_NAME).toBe("Darb Study International");
    expect(BRAND_NAME_AR).toBe("درب للتعليم الدولي");
  });

  it("uses the Darb gold as the only yellow accent", () => {
    // AGENTS.md: #F9B115 is the one sanctioned yellow.
    expect(color.gold).toBe("#f9b115");
    const hexes = Object.values(color).map((c) => c.toLowerCase());
    expect(hexes).not.toContain("#ffc107");
    expect(hexes).not.toContain("#f4c84a");
  });

  it("provides contact channels", () => {
    expect(SUPPORT_WHATSAPP_URL).toMatch(/^https:\/\/wa\.me\//);
    expect(SUPPORT_PHONE).toMatch(/^\+/);
  });

  it("links the social profiles with https urls", () => {
    expect(SOCIAL_LINKS.length).toBeGreaterThan(0);
    for (const link of SOCIAL_LINKS) {
      expect(link.name).toBeTruthy();
      expect(link.label).toBeTruthy();
      expect(link.href).toMatch(/^https:\/\//);
    }
  });

  it("defines a font stack and size scale", () => {
    expect(font.family).toContain("sans-serif");
    expect(font.size.h1).toBeTruthy();
    expect(font.size.body).toBeTruthy();
    expect(radius.card).toBeTruthy();
    expect(radius.button).toBeTruthy();
  });
});
