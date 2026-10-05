import { describe, expect, it } from "vitest";
import {
  CITY_GUIDES,
  getCityGuide,
  isHeidelberg,
  isRegensburg,
  mapsSearchUrl,
  normalizeResidentialCity,
  HEIDELBERG_CITY_GUIDE,
  REGENSBURG_CITY_GUIDE,
} from "@/data/studentCityGuides";

describe("student city guide", () => {
  it("normalizes Heidelberg city variants", () => {
    expect(normalizeResidentialCity(" Heidelberg ")).toBe("heidelberg");
    expect(normalizeResidentialCity("HEIDELBERG")).toBe("heidelberg");
    expect(isHeidelberg("Heidelberg")).toBe(true);
  });

  it("normalizes Regensburg city variants", () => {
    expect(normalizeResidentialCity(" Regensburg ")).toBe("regensburg");
    expect(normalizeResidentialCity("REGENSBURG")).toBe("regensburg");
    expect(isRegensburg("Regensburg")).toBe(true);
    expect(isRegensburg("Heidelberg")).toBe(false);
  });

  it("resolves each curated guide to its own city only", () => {
    expect(getCityGuide("Heidelberg")).toBe(HEIDELBERG_CITY_GUIDE);
    expect(getCityGuide("Regensburg")).toBe(REGENSBURG_CITY_GUIDE);
    expect(getCityGuide("Berlin")).toBeNull();
    expect(getCityGuide(null)).toBeNull();
  });

  it("keeps every guide reachable through the registry", () => {
    const ids = CITY_GUIDES.map((g) => g.id);
    expect(ids).toContain("heidelberg");
    expect(ids).toContain("regensburg");
    for (const guide of CITY_GUIDES) {
      expect(getCityGuide(guide.nameEn)).toBe(guide);
    }
  });

  it("creates a safe Google Maps search URL", () => {
    const url = mapsSearchUrl("F+U Academy of Languages, Heidelberg");
    expect(url).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(url).toContain("Heidelberg");
  });

  it("keeps the curated school/accommodation anchors present", () => {
    const ids = HEIDELBERG_CITY_GUIDE.locations.map((location) => location.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "fu-academy",
        "fu-campus",
        "fu-maerzgasse",
        "kaufland-weststadt",
        "hauptbahnhof",
        "gloria-kino",
        "university-hospital",
        "hof-apotheke",
      ]),
    );
  });

  it("anchors the Regensburg guide on the HORIZONTE school", () => {
    const ids = REGENSBURG_CITY_GUIDE.locations.map((location) => location.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "horizonte",
        "horizonte-residence",
        "regensburg-hauptbahnhof",
        "university-hospital-regensburg",
        "clever-fit-regensburg",
        "st-peters-cathedral",
        "stone-bridge",
      ]),
    );
    expect(REGENSBURG_CITY_GUIDE.schoolName).toBe(
      "HORIZONTE German Language School",
    );
    expect(REGENSBURG_CITY_GUIDE.locations[0].id).toBe("horizonte");
  });

  it("keeps the Regensburg official links and city green spaces", () => {
    const byId = new Map(REGENSBURG_CITY_GUIDE.locations.map((l) => [l.id, l]));
    expect(byId.get("horizonte")?.websiteUrl).toBe(
      "https://www.horizonte.com/en-german-courses/regensburg",
    );
    expect(byId.get("st-peters-cathedral")?.websiteUrl).toMatch(
      /^https:\/\/tourismus\.regensburg\.de\//,
    );
    expect(byId.get("university-hospital-regensburg")?.websiteUrl).toBe(
      "https://www.ukr.de/en",
    );
    expect(byId.get("clever-fit-regensburg")?.websiteUrl).toMatch(
      /^https:\/\/www\.clever-fit\.com\//,
    );
    expect(byId.get("stadtbuecherei-haidplatz")?.websiteUrl).toMatch(
      /^https:\/\/www\.regensburg\.de\//,
    );
    expect(byId.get("regensburg-arcaden")?.websiteUrl).toMatch(
      /^https:\/\/www\.regensburg-arcaden\.de\//,
    );
    expect([...byId.keys()]).toEqual(
      expect.arrayContaining([
        "world-heritage-visitor-center",
        "stadtpark-regensburg",
        "herzogspark-regensburg",
        "villapark-regensburg",
        "donaupark-regensburg",
      ]),
    );
  });

  it("gives every official link an https URL and a map query", () => {
    for (const guide of CITY_GUIDES) {
      for (const location of guide.locations) {
        expect(location.mapQuery.trim(), location.id).toBeTruthy();
        if (location.websiteUrl !== undefined) {
          expect(location.websiteUrl, location.id).toMatch(/^https:\/\//);
        }
      }
      expect(guide.mapQuery.trim(), guide.id).toBeTruthy();
    }
  });
});

import { isCacheFresh } from "@/lib/cityGuideCache";

describe("city guide tips + cache", () => {
  it("every location has a DARB tip in en/ar/he", () => {
    for (const guide of CITY_GUIDES) {
      for (const l of guide.locations) {
        expect(l.tipEn?.trim(), l.id).toBeTruthy();
        expect(l.tipAr?.trim(), l.id).toBeTruthy();
        expect(l.tipHe?.trim(), l.id).toBeTruthy();
      }
    }
  });
  it("cache freshness is 7 days", () => {
    const now = Date.parse("2026-09-30T00:00:00Z");
    expect(isCacheFresh(null, now)).toBe(false);
    expect(isCacheFresh("2026-09-25T00:00:00Z", now)).toBe(true);
    expect(isCacheFresh("2026-09-20T00:00:00Z", now)).toBe(false);
  });
});
