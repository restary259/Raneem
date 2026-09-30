import { describe, expect, it } from "vitest";
import {
  getCityGuide,
  isHeidelberg,
  mapsSearchUrl,
  normalizeResidentialCity,
  HEIDELBERG_CITY_GUIDE,
} from "@/data/studentCityGuides";

describe("student city guide", () => {
  it("normalizes Heidelberg city variants", () => {
    expect(normalizeResidentialCity(" Heidelberg ")).toBe("heidelberg");
    expect(normalizeResidentialCity("HEIDELBERG")).toBe("heidelberg");
    expect(isHeidelberg("Heidelberg")).toBe(true);
  });

  it("only activates the curated guide for Heidelberg", () => {
    expect(getCityGuide("Heidelberg")).toBe(HEIDELBERG_CITY_GUIDE);
    expect(getCityGuide("Berlin")).toBeNull();
    expect(getCityGuide(null)).toBeNull();
  });

  it("creates a safe Google Maps search URL", () => {
    const url = mapsSearchUrl("F+U Academy of Languages, Heidelberg");
    expect(url).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(url).toContain("Heidelberg");
  });

  it("keeps the curated school/accommodation anchors present", () => {
    const ids = HEIDELBERG_CITY_GUIDE.locations.map((location) => location.id);
    expect(ids).toEqual(expect.arrayContaining([
      "fu-academy",
      "fu-campus",
      "fu-maerzgasse",
      "kaufland-weststadt",
      "hauptbahnhof",
      "gloria-kino",
      "university-hospital",
      "hof-apotheke",
    ]));
  });
});
