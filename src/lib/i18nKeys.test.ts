import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PROFILE_FIELD_LABEL_KEYS } from "./studentProfileFields";

/**
 * Guards against untranslated UI: every t('key') used in the source must exist
 * in both the Arabic and English dictionaries of one of the component's namespaces.
 */

const ROOT = process.cwd();
const LOCALES = ["ar", "en"] as const;

const TEAM_MAJORS_HEBREW_KEYS = [
  "intel.card.empty",
  "intel.card.language.german",
  "intel.card.language.english",
  "intel.card.back",
  "intel.status.verified",
  "intel.card.notFilled",
  "intel.card.tabLanguage",
  "intel.card.tabBagrut",
  "intel.card.formalEligibility",
  "intel.card.tabSchools",
  "intel.card.tabDeadlines",
  "intel.card.tabUniversities",
  "intel.card.teachingLanguage",
  "intel.none",
  "intel.card.requiredLevel",
  "intel.card.levelMap",
  "intel.card.required",
  "intel.card.below",
  "intel.card.above",
  "intel.card.acceptedProof",
  "intel.card.additionalLanguage",
  "intel.card.languageTiming",
  "intel.row.math",
  "intel.row.english",
  "intel.row.further",
  "intel.card.benchmarkTitle",
  "intel.card.benchmarkBadge",
  "intel.card.benchmarkValueLabel",
  "intel.card.benchmarkHint",
  "intel.card.benchmarkSource",
  "intel.card.gradeTable",
  "intel.card.conversionFormula",
  "intel.calculatedOnly",
  "intel.card.publishedThreshold",
  "intel.card.compensation",
  "intel.card.admissionMode",
  "intel.card.applicationChannel",
  "intel.row.deadline",
  "intel.card.entranceProcedure",
  "intel.card.startTiming",
  "intel.recommendations.title",
  "intel.recommendations.subtitle",
  "intel.recommendations.count",
  "intel.recommendations.primary",
  "intel.recommendations.tu9",
  "intel.recommendations.exact",
  "intel.recommendations.related",
  "intel.recommendations.openProgramme",
  "intel.recommendations.openCatalogue",
  "intel.recommendations.verifiedRoutes",
] as const;
const loadDicts = (lang: string) => {
  const dir = path.join(ROOT, "public/locales", lang);
  const dicts: Record<string, any> = {};
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith(".json")) dicts[file.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  }
  return dicts;
};

const walk = (dir: string, out: string[] = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
};

const hasKey = (dict: any, key: string) => {
  let cursor = dict;
  for (const part of key.split(".")) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) return false;
    cursor = cursor[part];
  }
  return true;
};

describe("i18n coverage", () => {
  it("has every used translation key in both Arabic and English", () => {
    const dicts = Object.fromEntries(LOCALES.map((l) => [l, loadDicts(l)]));
    const missing: string[] = [];

    for (const file of walk(path.join(ROOT, "src"))) {
      const src = fs.readFileSync(file, "utf8");
      if (!/useTranslation\(/.test(src)) continue;
      // A file may call useTranslation several times; the default namespace is "common".
      const namespaces = new Set<string>(["common"]);
      for (const nsCall of src.matchAll(/useTranslation\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g)) {
        for (const n of nsCall[1].matchAll(/['"]([^'"]+)['"]/g)) namespaces.add(n[1]);
      }

      const callRe = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]\s*(?:,\s*\{[^}]*ns:\s*['"]([a-zA-Z0-9_]+)['"])?/g;
      for (const m of src.matchAll(callRe)) {
        const key = m[1];
        if (!key.includes(".")) continue; // not a namespaced lookup
        const candidates = m[2] ? [m[2]] : [...namespaces];
        for (const lang of LOCALES) {
          const found = candidates.some((ns) => dicts[lang][ns] && hasKey(dicts[lang][ns], key));
          if (!found) missing.push(`${lang}: ${key} (${path.relative(ROOT, file)})`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("has all Team Majors card copy in Hebrew", () => {
    const dashboard = loadDicts("he").dashboard;
    expect(dashboard, "Hebrew dashboard dictionary").toBeDefined();
    for (const key of TEAM_MAJORS_HEBREW_KEYS) {
      expect(hasKey(dashboard, key), `he: ${key}`).toBe(true);
    }
  });

  it("has every profile-summary label key in the dashboard dictionaries", () => {
    for (const lang of LOCALES) {
      const dashboard = loadDicts(lang).dashboard;
      for (const key of Object.values(PROFILE_FIELD_LABEL_KEYS)) {
        expect(hasKey(dashboard, key), `${lang}: ${key}`).toBe(true);
      }
    }
  });

  it("does not contain legacy or malformed interpolation placeholders", () => {
    const invalid: string[] = [];
    for (const lang of LOCALES) {
      const dir = path.join(ROOT, "public/locales", lang);
      for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".json"))) {
        const source = fs.readFileSync(path.join(dir, file), "utf8");
        if (/\{\{n\}\}|\(\([^)]*\)\)/.test(source)) invalid.push(`${lang}/${file}`);
      }
    }
    expect(invalid).toEqual([]);
  });
});
