import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const WRONG_ARABIC_BRAND = /دارب|دآرب|دَرْب|دَرب/;
const LATIN_BRAND = /\b(?:DARB|Darb)\b/;

const ARABIC_LOCALE_DIRS = [
  path.join(ROOT, "public/locales/ar"),
  path.join(ROOT, "src/locales/ar"),
];

const walkFiles = (entry: string): string[] => {
  if (!fs.existsSync(entry)) return [];
  const stat = fs.statSync(entry);
  if (stat.isFile()) return [entry];
  return fs.readdirSync(entry).flatMap((name) => walkFiles(path.join(entry, name)));
};

const collectStrings = (value: unknown, location: string, out: Array<[string, string]>) => {
  if (typeof value === "string") {
    out.push([location, value]);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => collectStrings(child, `${location}.${index}`, out));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.entries(value).forEach(([key, child]) => collectStrings(child, `${location}.${key}`, out));
};

const latinBrandIsAllowed = (value: string) =>
  /(?:https?:\/\/|[\w.+-]+@)\S*darb\.agency/i.test(value) ||
  /درب \(Darb\)/.test(value) ||
  /\bDARB-\d+\b/.test(value);

describe("Arabic DARB brand spelling", () => {
  it("uses درب instead of known Arabic misspellings in user-facing sources", () => {
    const files = [
      ...ARABIC_LOCALE_DIRS.flatMap(walkFiles),
      path.join(ROOT, "src/utils/invoicePdf.ts"),
      path.join(ROOT, "src/pages/InvoicePage.tsx"),
      ...walkFiles(path.join(ROOT, "src/lib/email-templates")),
      ...walkFiles(path.join(ROOT, "supabase/functions/_shared/transactional-email-templates")),
    ].filter((file) => /\.(?:json|ts|tsx)$/.test(file));

    const invalid = files.flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      return WRONG_ARABIC_BRAND.test(source) ? [path.relative(ROOT, file)] : [];
    });

    expect(invalid).toEqual([]);
  });

  it("does not expose Latin DARB branding inside Arabic locale values", () => {
    const invalid: string[] = [];

    for (const dir of ARABIC_LOCALE_DIRS) {
      for (const file of walkFiles(dir).filter((candidate) => candidate.endsWith(".json"))) {
        const values: Array<[string, string]> = [];
        collectStrings(JSON.parse(fs.readFileSync(file, "utf8")) as unknown, path.relative(ROOT, file), values);
        for (const [location, value] of values) {
          if (LATIN_BRAND.test(value) && !latinBrandIsAllowed(value)) invalid.push(location);
        }
      }
    }

    expect(invalid).toEqual([]);
  });
});
