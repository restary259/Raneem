import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guards against untranslated UI: every t('key') used in the source must exist
 * in both the Arabic and English dictionaries of one of the component's namespaces.
 */

const ROOT = process.cwd();
const LOCALES = ["ar", "en"] as const;

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
});
