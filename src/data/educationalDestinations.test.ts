import { describe, expect, it } from "vitest";
import {
  ACTIVE_DESTINATION_CITIES,
  activeLanguageYearCities,
  countries,
  languageSchools,
  languageYearCities,
  languageYearSchools,
  services,
  tu9Universities,
  universities,
} from "./educationalDestinations";

describe("languageYearCities", () => {
  it("exposes a unique id per city", () => {
    const ids = languageYearCities.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every city the fields the UI renders", () => {
    for (const city of languageYearCities) {
      expect(city.name).toBeTruthy();
      expect(city.region).toBeTruthy();
      expect(city.imageUrl).toBeTruthy();
      expect(city.cityUrl).toMatch(/^https:\/\//);
      expect(city.descriptionKey).toMatch(/^destinations\./);
      expect(city.highlights.length).toBeGreaterThan(0);
      expect(city.activityLinks.length).toBeGreaterThan(0);
      for (const link of city.activityLinks) {
        expect(link.labelKey).toMatch(/^destinations\./);
        expect(link.url).toMatch(/^https:\/\//);
      }
    }
  });
});

describe("languageYearSchools", () => {
  it("points every school at an existing city", () => {
    const cityIds = new Set(languageYearCities.map((c) => c.id));
    for (const school of languageYearSchools) {
      expect(cityIds.has(school.city)).toBe(true);
    }
  });

  it("covers each city with at least one school", () => {
    const covered = new Set(languageYearSchools.map((s) => s.city));
    for (const city of languageYearCities) {
      expect(covered.has(city.id)).toBe(true);
    }
  });

  it("gives every school a description and focus keys", () => {
    for (const school of languageYearSchools) {
      expect(school.name).toBeTruthy();
      expect(school.officialUrl).toMatch(/^https:\/\//);
      expect(school.descriptionKey).toMatch(/^destinations\./);
      expect(school.credentials.length).toBeGreaterThan(0);
      expect(school.focusKeys.length).toBeGreaterThan(0);
      expect(school.examKeys.length).toBeGreaterThan(0);
      expect(school.serviceKeys.length).toBeGreaterThan(0);
    }
  });
});

describe("tu9Universities", () => {
  it("lists the nine German technical universities", () => {
    expect(tu9Universities).toHaveLength(9);
  });

  it("gives every university a name, city, https url and logo", () => {
    for (const uni of tu9Universities) {
      expect(uni.name).toBeTruthy();
      expect(uni.city).toBeTruthy();
      expect(uni.url).toMatch(/^https:\/\//);
      expect(uni.logoUrl).toBeTruthy();
    }
  });
});

describe("backward-compatible exports", () => {
  it("derives the legacy universities shape from the TU9 list", () => {
    expect(universities.germany).toHaveLength(tu9Universities.length);
    expect(universities.germany[0]).toMatchObject({
      name: tu9Universities[0].name,
      location: `${tu9Universities[0].city}, Germany`,
      officialUrl: tu9Universities[0].url,
    });
  });

  it("derives the legacy languageSchools shape", () => {
    expect(languageSchools.germany).toHaveLength(languageYearSchools.length);
    expect(languageSchools.germany[0].programs).toEqual(
      languageYearSchools[0].examKeys,
    );
  });

  it("keeps empty placeholder collections", () => {
    expect(services.germany).toEqual([]);
    expect(countries).toHaveLength(1);
    expect(countries[0].code).toBe("germany");
  });
});

describe("ACTIVE_DESTINATION_CITIES", () => {
  it("only contains known city ids", () => {
    const cityIds = new Set(languageYearCities.map((c) => c.id));
    for (const id of ACTIVE_DESTINATION_CITIES) {
      expect(cityIds.has(id)).toBe(true);
    }
  });

  it("filters activeLanguageYearCities to the active ids", () => {
    expect(activeLanguageYearCities.map((c) => c.id)).toEqual(
      languageYearCities
        .filter((c) => ACTIVE_DESTINATION_CITIES.includes(c.id))
        .map((c) => c.id),
    );
    expect(activeLanguageYearCities.length).toBeGreaterThan(0);
  });

  it("hides inactive cities without deleting their data", () => {
    // Every inactive city must still be present in the full dataset.
    const inactive = languageYearCities.filter(
      (c) => !ACTIVE_DESTINATION_CITIES.includes(c.id),
    );
    for (const city of inactive) {
      expect(languageYearCities.some((c) => c.id === city.id)).toBe(true);
    }
  });
});
