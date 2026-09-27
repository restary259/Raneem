import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guards Hebrew locale coverage: every key present in the English dictionary of
 * a namespace must also exist in the Hebrew one. Without this, a new English
 * string silently renders as English for Hebrew users instead of being caught.
 *
 * Namespaces listed in UNTRANSLATED stay exempt until their Hebrew file is
 * added; remove an entry from that list in the same change that adds the file.
 */

const ROOT = process.cwd();
const EN_DIR = path.join(ROOT, "public", "locales", "en");
const HE_DIR = path.join(ROOT, "public", "locales", "he");

// `dashboard.json` is the in-app UI (~4.8k keys); it lives in the same
// public/locales tree as everything else, so it is covered by the standard
// check rather than exempted.
const TRACKED_SEPARATELY = new Set<string>([]);
const PENDING_NATIVE_REVIEW = new Set<string>([]);

const leafPaths = (node: unknown, prefix = ""): string[] => {
  if (Array.isArray(node)) {
    return node.flatMap((v, i) => leafPaths(v, `${prefix}[${i}]`));
  }
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([k, v]) =>
      leafPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
};

const read = (dir: string, file: string): unknown =>
  JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));

describe("he locale coverage", () => {
  const namespaces = fs
    .readdirSync(EN_DIR)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !TRACKED_SEPARATELY.has(f))
    .filter((f) => !PENDING_NATIVE_REVIEW.has(f));

  it.each(namespaces)("%s exists in he with full key coverage", (file) => {
    const hePath = path.join(HE_DIR, file);
    expect(fs.existsSync(hePath), `missing public/locales/he/${file}`).toBe(
      true,
    );

    const enKeys = new Set(leafPaths(read(EN_DIR, file)));
    const heKeys = new Set(leafPaths(read(HE_DIR, file)));
    const missing = [...enKeys].filter((k) => !heKeys.has(k));

    expect(
      missing,
      `public/locales/he/${file} is missing ${missing.length} key(s):\n  ${missing
        .slice(0, 25)
        .join("\n  ")}`,
    ).toEqual([]);
  });

  it("every namespace is either covered or explicitly exempt", () => {
    const all = fs.readdirSync(EN_DIR).filter((f) => f.endsWith(".json"));
    const unaccounted = all.filter(
      (f) =>
        !TRACKED_SEPARATELY.has(f) &&
        !PENDING_NATIVE_REVIEW.has(f) &&
        !namespaces.includes(f),
    );
    expect(unaccounted).toEqual([]);
  });
});

/**
 * `src/locales/he/*` holds the eagerly-bundled copies of the namespaces every
 * route needs (mirroring src/locales/en and src/locales/ar). They must stay
 * byte-identical to public/locales/he/*, which is the source of truth served to
 * the HTTP backend — otherwise first paint and on-demand loads disagree.
 */
describe("he bundled locale copies", () => {
  const BUNDLED = ["common", "landing", "contact", "broadcast", "legal"];

  it.each(BUNDLED)("src/locales/he/%s.json matches public/locales/he", (ns) => {
    const bundled = read(path.join(ROOT, "src", "locales", "he"), `${ns}.json`);
    const source = read(HE_DIR, `${ns}.json`);
    expect(bundled).toEqual(source);
  });

  it("the i18n config bundles exactly the mirrored namespaces", () => {
    const config = fs.readFileSync(path.join(ROOT, "src", "i18n.ts"), "utf8");
    for (const ns of BUNDLED) {
      expect(config).toContain(`${ns}He`);
    }
  });
});
