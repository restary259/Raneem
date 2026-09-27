import { describe, expect, it } from "vitest";
import { majorsData } from "@/data/majorsData";
import {
  getLocalizedCategoryTitle,
  getLocalizedGlance,
  getLocalizedLanguageProfile,
  getLocalizedMajor,
  getLocalizedSources,
  getLocalizedTiers,
} from "@/utils/majorLocale";
import { majorLabel } from "@/components/apply/MajorAutocomplete";
import { isArabicUi } from "@/lib/localeData";
import { getMajorIntel } from "@/data/intel/majorIntel";

/**
 * The majors/university dataset is authored in Arabic + English only. Arabic is
 * therefore the only language allowed to read the Arabic side; Hebrew must read
 * English (app-wide `fallbackLng: { he: ['en'] }`).
 *
 * These tests lock that in both directions, because the failure mode is silent:
 * a `lang === 'en' ? EN : AR` selector hands Hebrew the ARABIC copy, which
 * renders unreadable prose to Hebrew users with no error anywhere.
 */

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

/** Every major that actually carries Arabic prose, so the assertions aren't vacuous. */
const majorsWithArabic = majorsData
  .flatMap((category) => category.subMajors.map((m) => ({ major: m, categoryTitle: category.title })));
const major = majorsWithArabic[0].major;

describe("isArabicUi", () => {
  it("is true only for Arabic", () => {
    expect(isArabicUi("ar")).toBe(true);
    expect(isArabicUi("ar-SA")).toBe(true);
    expect(isArabicUi("en")).toBe(false);
    expect(isArabicUi("he")).toBe(false);
    expect(isArabicUi(undefined)).toBe(false);
  });
});

describe("majors localization — Hebrew must never receive Arabic", () => {
  it("Arabic reads the Arabic side", () => {
    const loc = getLocalizedMajor(major, "ar");
    expect(loc.name).toBe(major.nameAR);
    expect(loc.desc).toBe(major.description);
  });

  it("English reads the English side", () => {
    const loc = getLocalizedMajor(major, "en");
    expect(loc.name).toBe(major.nameEN);
    expect(loc.desc).toBe(major.descriptionEN);
  });

  it("Hebrew reads the English side, not the Arabic copy", () => {
    const loc = getLocalizedMajor(major, "he");
    expect(loc.name).toBe(major.nameEN);
    expect(loc.name).not.toBe(major.nameAR);
    expect(loc.desc).toBe(major.descriptionEN);
  });

  it("no Hebrew-visible major field contains Arabic script", () => {
    const seen = new Set<string>();
    for (const { major: m } of majorsWithArabic) {
      const loc = getLocalizedMajor(m, "he");
      for (const value of [
        loc.name,
        loc.desc,
        loc.detailedDesc,
        loc.localizedDuration,
        loc.localizedCareerProspects,
        loc.localizedRequirements,
        loc.localizedSuitableFor,
        loc.localizedRequiredBackground,
        loc.localizedLanguageRequirements,
        loc.localizedCareerOpportunities,
        loc.localizedArab48Notes,
      ]) {
        if (value) seen.add(value);
      }
    }
    const leaked = [...seen].filter((v) => ARABIC_SCRIPT.test(v));
    expect(leaked).toEqual([]);
    // Guard against a vacuous pass: the dataset must have produced real copy.
    expect(seen.size).toBeGreaterThan(50);
  });

  it("structured blocks follow the same rule", () => {
    const withBlocks = majorsWithArabic.find(
      (x) => x.major.glance && x.major.languageProfile && x.major.requirementTiers && x.major.sources?.length,
    );
    expect(withBlocks, "expected at least one major with all structured blocks").toBeTruthy();
    const m = withBlocks!.major;

    expect(getLocalizedGlance(m, "he")).toEqual(getLocalizedGlance(m, "en"));
    expect(getLocalizedLanguageProfile(m, "he")).toEqual(getLocalizedLanguageProfile(m, "en"));
    expect(getLocalizedTiers(m, "he")).toEqual(getLocalizedTiers(m, "en"));
    expect(getLocalizedSources(m, "he")).toEqual(getLocalizedSources(m, "en"));
    // …while Arabic still diverges from English (i.e. the rule is real).
    expect(getLocalizedGlance(m, "ar")).not.toEqual(getLocalizedGlance(m, "en"));
  });

  it("category titles fall back to English for Hebrew", () => {
    const { major: m, categoryTitle } = majorsWithArabic[0];
    const titleEN = "Health & Medical Sciences";
    expect(getLocalizedCategoryTitle(categoryTitle, titleEN, "he")).toBe(titleEN);
    expect(getLocalizedCategoryTitle(categoryTitle, titleEN, "ar")).toBe(categoryTitle);
  });

  it("majorLabel (apply form) reads English for Hebrew", () => {
    const intel = getMajorIntel("computer-science");
    expect(intel).toBeTruthy();
    expect(majorLabel(intel!, "he")).toBe(intel!.canonicalEN);
    expect(majorLabel(intel!, "ar")).toBe(intel!.canonicalAR);
  });
});

/**
 * Drift guard: a binary `lang === 'en' ? EN : AR` selector is the exact bug this
 * fixes. Fail if one is reintroduced anywhere in the majors path.
 */
describe("no binary English-vs-otherwise data selectors remain", () => {
  it("majors localization files select on isArabicUi", async () => {
    const { readFileSync } = await import("node:fs");
    const files = [
      "src/utils/majorLocale.ts",
      "src/components/educational/MajorCard.tsx",
      "src/components/educational/MajorModal.tsx",
      "src/components/apply/MajorAutocomplete.tsx",
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} must not treat "not English" as Arabic`).not.toMatch(
        /lang\s*===\s*['"]en['"]\s*\?/,
      );
    }
  });
});
