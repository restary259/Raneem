import { describe, it, expect } from "vitest";
import {
  groupAccommodationsBySchool,
  distinctCities,
  filterCatalog,
  roomTypeLabel,
  mealsLabel,
  formatWeeklyPrice,
  cheapestWeeklyRate,
  weeklyPriceRange,
  displayWeeklyRate,
  primaryPhoto,
  localizedName,
  localizedDescription,
  type CatalogSchool,
  type CatalogAccommodation,
} from "./catalogDisplay";

const school = (overrides: Partial<CatalogSchool> = {}): CatalogSchool => ({
  id: "s1",
  name_ar: "مدرسة",
  name_en: "School One",
  city: "Heidelberg",
  country: "Germany",
  slug: "school-one",
  website: null,
  description_en: "desc en",
  description_ar: "وصف ar",
  photos: [],
  is_active: true,
  created_at: "",
  updated_at: "",
  ...overrides,
});

const acc = (overrides: Partial<CatalogAccommodation> = {}): CatalogAccommodation => ({
  created_at: "",
  currency: "EUR",
  deposit: null,
  description: null,
  description_ar: null,
  description_en: null,
  distance_note: null,
  id: "a1",
  is_active: true,
  meals: null,
  name_ar: "سكن",
  name_en: "Accom One",
  photos: null,
  placement_fee: null,
  price: 200,
  price_tiers: [],
  room_type: "single",
  school_id: "s1",
  updated_at: "",
  ...overrides,
});

describe("catalogDisplay", () => {
  describe("groupAccommodationsBySchool", () => {
    it("groups accommodations under their owning school", () => {
      const s1 = school();
      const s2 = school({ id: "s2", name_en: "School Two" });
      const a1 = acc({ school_id: "s1" });
      const a2 = acc({ id: "a2", school_id: "s1" });
      const a3 = acc({ id: "a3", school_id: "s2" });
      const groups = groupAccommodationsBySchool([s1, s2], [a1, a2, a3]);
      expect(groups).toHaveLength(2);
      expect(groups[0].accommodations).toHaveLength(2);
      expect(groups[1].accommodations).toHaveLength(1);
    });

    it("drops schools with no accommodations", () => {
      const s1 = school();
      const s2 = school({ id: "s2" });
      const a1 = acc({ school_id: "s1" });
      const groups = groupAccommodationsBySchool([s1, s2], [a1]);
      expect(groups).toHaveLength(1);
      expect(groups[0].school.id).toBe("s1");
    });

    it("collects orphan accommodations under an 'Other' group", () => {
      const s1 = school();
      const orphan = acc({ id: "o1", school_id: null });
      const groups = groupAccommodationsBySchool([s1], [orphan]);
      expect(groups).toHaveLength(1);
      expect(groups[0].school.id).toBe("__other__");
      expect(groups[0].accommodations[0].id).toBe("o1");
    });

    it("sorts accommodations within a school by name_en", () => {
      const s1 = school();
      const b = acc({ id: "b", name_en: "Bravo" });
      const a = acc({ id: "a", name_en: "Alpha" });
      const groups = groupAccommodationsBySchool([s1], [b, a]);
      expect(groups[0].accommodations.map((x) => x.id)).toEqual(["a", "b"]);
    });
  });

  describe("distinctCities", () => {
    it("returns sorted unique cities", () => {
      const schools = [school({ city: "Berlin" }), school({ city: "Heidelberg" }), school({ city: "Berlin" }), school({ city: null })];
      expect(distinctCities(schools)).toEqual(["Berlin", "Heidelberg"]);
    });
  });

  describe("labels", () => {
    it("maps known room_type values", () => {
      expect(roomTypeLabel("single", "en")).toBe("Single room");
      expect(roomTypeLabel("studio", "ar")).toBe("استوديو");
    });
    it("falls back to the raw value for unknown room types", () => {
      expect(roomTypeLabel("dorm", "en")).toBe("dorm");
    });
    it("returns null for empty room type", () => {
      expect(roomTypeLabel(null, "en")).toBeNull();
    });
    it("maps known meals values", () => {
      expect(mealsLabel("half_board", "en")).toBe("Half board");
      expect(mealsLabel("self_catering", "ar")).toBe("إقامة ذاتية");
    });
    it("falls back to the raw value for unknown meals", () => {
      expect(mealsLabel("lunch", "en")).toBe("lunch");
    });
  });

  describe("pricing", () => {
    it("formats a flat weekly price with the currency symbol", () => {
      expect(formatWeeklyPrice(acc({ price: 210, currency: "EUR" }))).toBe("€210");
    });
    it("returns null when no price and no tiers", () => {
      expect(formatWeeklyPrice(acc({ price: null }))).toBeNull();
    });
    it("cheapestWeeklyRate picks the lowest tier", () => {
      const a = acc({
        price: 245,
        price_tiers: [{ from_weeks: 1, to_weeks: 4, price: 245 }, { from_weeks: 5, to_weeks: null, price: 210 }],
      });
      expect(cheapestWeeklyRate(a)).toBe(210);
    });
    it("weeklyPriceRange returns [min,max] across tiers", () => {
      const a = acc({
        price: 245,
        price_tiers: [{ from_weeks: 1, to_weeks: 4, price: 245 }, { from_weeks: 5, to_weeks: null, price: 210 }],
      });
      expect(weeklyPriceRange(a)).toEqual([210, 245]);
    });
    it("weeklyPriceRange returns [base,base] for a flat price", () => {
      expect(weeklyPriceRange(acc({ price: 200, price_tiers: [] }))).toEqual([200, 200]);
    });
    it("weeklyPriceRange returns null when no price", () => {
      expect(weeklyPriceRange(acc({ price: null, price_tiers: [] }))).toBeNull();
    });
    it("formatWeeklyPrice shows the cheapest (long-stay) rate, not the entry rate, when a range exists", () => {
      // €245 entry for weeks 1–4, €210 for week 5+. "from" must mean €210.
      const a = acc({
        price: 245,
        price_tiers: [{ from_weeks: 1, to_weeks: 4, price: 245 }, { from_weeks: 5, to_weeks: null, price: 210 }],
      });
      expect(formatWeeklyPrice(a, "en")).toBe("€210");
      expect(displayWeeklyRate(a)).toBe(210);
      // The range still reports both bounds for the "€210 – €245 per week" sub-line.
      expect(weeklyPriceRange(a)).toEqual([210, 245]);
    });
    it("displayWeeklyRate returns null when no price", () => {
      expect(displayWeeklyRate(acc({ price: null, price_tiers: [] }))).toBeNull();
    });
  });

  describe("photos", () => {
    it("returns the first non-empty photo", () => {
      expect(primaryPhoto(["/a.jpg", "/b.jpg"])).toBe("/a.jpg");
      expect(primaryPhoto(["", "/b.jpg"])).toBe("/b.jpg");
      expect(primaryPhoto(null)).toBeNull();
      expect(primaryPhoto([])).toBeNull();
    });
  });

  describe("localized fields", () => {
    it("prefers the active language", () => {
      const a = acc({ name_en: "Studio", name_ar: "استوديو" });
      expect(localizedName(a, "en")).toBe("Studio");
      expect(localizedName(a, "ar")).toBe("استوديو");
    });
    it("falls back to the other language when the preferred is empty", () => {
      const a = acc({ name_en: "Studio", name_ar: "" });
      expect(localizedName(a, "ar")).toBe("Studio");
    });
    it("localizedDescription prefers lang-specific then generic", () => {
      const a = acc({ description_en: "en", description_ar: "ar", description: "gen" });
      expect(localizedDescription(a, "en")).toBe("en");
      expect(localizedDescription(a, "ar")).toBe("ar");
      const b = acc({ description_en: null, description_ar: null, description: "gen" });
      expect(localizedDescription(b, "en")).toBe("gen");
    });
  });

  describe("filterCatalog", () => {
    const s1 = school({ id: "s1", name_en: "Alpha School", city: "Heidelberg" });
    const s2 = school({ id: "s2", name_en: "Beta School", city: "Berlin" });
    const a1 = acc({ id: "a1", school_id: "s1", name_en: "Studio One", room_type: "studio" });
    const a2 = acc({ id: "a2", school_id: "s1", name_en: "Shared Two", room_type: "shared" });
    const a3 = acc({ id: "a3", school_id: "s2", name_en: "Apartment Three", room_type: "apartment" });
    const orphan = acc({ id: "orphan", school_id: null, name_en: "Orphan Stay", room_type: "single" });
    const schools = [s1, s2];
    const accommodations = [a1, a2, a3, orphan];
    const noFilter = { search: "", city: "", schoolId: "", roomType: "" };

    it("returns all schools/groups when no filter is active (orphans included under Other)", () => {
      const groups = filterCatalog(schools, accommodations, noFilter);
      const ids = groups.flatMap((g) => g.accommodations.map((a) => a.id));
      expect(ids.sort()).toEqual(["a1", "a2", "a3", "orphan"]);
      // Orphan group flagged, last.
      expect(groups[groups.length - 1].isOther).toBe(true);
    });

    it("schoolId filter scopes to that school's accommodations and drops orphans", () => {
      const groups = filterCatalog(schools, accommodations, { ...noFilter, schoolId: "s1" });
      const ids = groups.flatMap((g) => g.accommodations.map((a) => a.id));
      expect(ids.sort()).toEqual(["a1", "a2"]);
    });

    it("city filter uses the school's city (not the accommodation's own city field)", () => {
      const groups = filterCatalog(schools, accommodations, { ...noFilter, city: "Heidelberg" });
      const ids = groups.flatMap((g) => g.accommodations.map((a) => a.id));
      expect(ids.sort()).toEqual(["a1", "a2"]);
    });

    it("roomType filter matches the raw room_type value", () => {
      const groups = filterCatalog(schools, accommodations, { ...noFilter, roomType: "studio" });
      const ids = groups.flatMap((g) => g.accommodations.map((a) => a.id));
      expect(ids).toEqual(["a1"]);
    });

    it("search matches accommodation and school fields", () => {
      const byAcc = filterCatalog(schools, accommodations, { ...noFilter, search: "studio" });
      expect(byAcc.flatMap((g) => g.accommodations.map((a) => a.id))).toEqual(["a1"]);
      const bySchool = filterCatalog(schools, accommodations, { ...noFilter, search: "beta" });
      expect(bySchool.flatMap((g) => g.accommodations.map((a) => a.id))).toEqual(["a3"]);
      const byCity = filterCatalog(schools, accommodations, { ...noFilter, search: "berlin" });
      expect(byCity.flatMap((g) => g.accommodations.map((a) => a.id))).toEqual(["a3"]);
    });

    it("combined city + roomType filters intersect", () => {
      const groups = filterCatalog(schools, accommodations, { ...noFilter, city: "Heidelberg", roomType: "shared" });
      expect(groups.flatMap((g) => g.accommodations.map((a) => a.id))).toEqual(["a2"]);
    });

    it("orphan accommodations are dropped under a city filter", () => {
      const groups = filterCatalog(schools, accommodations, { ...noFilter, city: "Heidelberg" });
      expect(groups.flatMap((g) => g.accommodations.map((a) => a.id))).not.toContain("orphan");
    });
  });
});
