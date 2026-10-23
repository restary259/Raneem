import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");
const STYLES = path.resolve(SRC_ROOT, "styles.css");
const STYLES_DIR = path.resolve(SRC_ROOT, "styles");

const styles = fs.readFileSync(STYLES, "utf8");

/**
 * Dead-CSS / dead-component cleanup guard. The classes below had zero
 * references in src, e2e and the production bundle; the files below had zero
 * importers. They must not creep back in — the Tailwind entry is the only
 * place live rules belong.
 */
const DEAD_CLASSES = [
  "darb-logo-marquee",
  "darb-logo-marquee-track",
  "darb-logo-tile",
  "darb-school-logo-tile",
  "darb-university-logo",
  "darb-logo-city",
  "darb-logo-fallback",
  "darb-home-hero-intro",
  "darb-home-hero-rule",
  "darb-home-hero-button",
  "darb-spectrum-accent",
  "card-hover",
  "btn-press",
  "dashboard-card",
  "stat-number",
];

const DELETED_FILES = [
  "animations.css",
  "accessibility.css",
  "layouts.css",
  "navigation.css",
  "pwa.css",
];

describe("P2-1 dead CSS does not return to the live entry", () => {
  it.each(DEAD_CLASSES)("styles.css no longer defines .%s", (cls) => {
    expect(styles).not.toContain(`.${cls}`);
  });

  it("no longer declares the unused marquee animations", () => {
    expect(styles).not.toContain("--animate-marquee:");
    expect(styles).not.toContain("@keyframes marquee {");
  });

  it("keeps the live brand palette variables", () => {
    // `--darb-logo-*` are the brand colours used by the spectrum bar — a
    // name-based sweep would have deleted them along with the dead marquee.
    expect(styles).toContain("--darb-logo-navy:");
    expect(styles).toContain("--darb-logo-gold:");
  });
});

describe("P2-1 orphaned style files and components stay deleted", () => {
  it.each(DELETED_FILES)("%s is gone", (file) => {
    expect(fs.existsSync(path.resolve(STYLES_DIR, file))).toBe(false);
  });

  it("styles.css imports only the live stylesheets", () => {
    const imports = [
      ...styles.matchAll(/@import\s+"\.\/styles\/([^"]+)"/g),
    ].map((m) => m[1]);
    expect(imports.sort()).toEqual(["cv-print.css", "neon.css"]);
  });

  it.each([
    ["landing", "PartnersMarquee.tsx"],
    ["common", "PullToRefresh.tsx"],
  ])("%s/%s is gone", (dir, file) => {
    expect(fs.existsSync(path.resolve(SRC_ROOT, "components", dir, file))).toBe(
      false,
    );
  });
});
