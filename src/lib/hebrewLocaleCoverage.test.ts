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
// Arabic is referenced only as translation evidence: a string Arabic translates
// is a string Hebrew must translate too.
const AR_DIR = path.join(ROOT, "public", "locales", "ar");

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

/** `path -> leaf value` for every scalar in a dictionary. */
const leafEntries = (node: unknown, prefix = ""): Map<string, unknown> => {
  const out = new Map<string, unknown>();
  const walk = (n: unknown, p: string) => {
    if (Array.isArray(n)) {
      n.forEach((v, i) => walk(v, `${p}[${i}]`));
    } else if (n && typeof n === "object") {
      for (const [k, v] of Object.entries(n)) walk(v, p ? `${p}.${k}` : k);
    } else {
      out.set(p, n);
    }
  };
  walk(node, prefix);
  return out;
};

const HEBREW_CHAR = /[\u0590-\u05FF]/;
const ARABIC_CHAR = /[\u0600-\u06FF\u0750-\u077F]/;

/**
 * Keys whose value is deliberately locale-independent: brand names, URLs,
 * asset paths, CSS/icon tokens, element ids, placeholders and codes. These may
 * legitimately be identical to English in every locale.
 */
const IDENTICAL_BY_DESIGN =
  /(url|href|image|avatar|focus|icon|fileUrl|fileSize|\.id$|Placeholder|placeholder|\.ph\.|^number$|^brand$|^code$|^slug$|^key$|^level$|^bic$|^iban$|path$|^campaign$|Campaign$|\.value\.|template)/i;

/**
 * Prose keys whose value must be translated. A key qualifies when English and
 * Arabic differ and the Arabic value actually contains Arabic script — i.e. an
 * existing reviewer decided this string is translatable, so Hebrew must not
 * silently fall back to English.
 */
const TRANSLATABLE = (key: string, en: unknown, ar: unknown): boolean => {
  if (typeof en !== "string" || typeof ar !== "string") return false;
  if (en.trim().length < 4) return false;
  if (en === ar) return false;
  if (!ARABIC_CHAR.test(ar)) return false;
  if (HEBREW_CHAR.test(en)) return false;
  return !IDENTICAL_BY_DESIGN.test(key);
};

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

  /**
   * Key presence alone does not mean translated: a Hebrew value copied verbatim
   * from English still satisfies the coverage check above while rendering
   * English to the user (the runtime `fallbackLng: { he: ['en'] }` makes a
   * missing value indistinguishable from a fallback). This asserts the value,
   * not just the path, for every string the Arabic locale proves translatable.
   */
  it.each(namespaces)(
    "%s has translated Hebrew values, not English copies",
    (file) => {
      const en = leafEntries(read(EN_DIR, file));
      const ar = leafEntries(read(AR_DIR, file));
      const he = leafEntries(read(HE_DIR, file));

      const untranslated = [...en.entries()]
        .filter(([key, enValue]) => {
          if (!TRANSLATABLE(key, enValue, ar.get(key))) return false;
          const heValue = he.get(key);
          return typeof heValue === "string" && heValue === enValue;
        })
        .map(([key]) => key);

      expect(
        untranslated,
        `public/locales/he/${file} renders English for ${untranslated.length} key(s):\n  ${untranslated
          .slice(0, 25)
          .join("\n  ")}`,
      ).toEqual([]);
    },
  );
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
