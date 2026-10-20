import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");
const STYLES = path.resolve(SRC_ROOT, "styles.css");
const DIALOG = path.resolve(SRC_ROOT, "components", "ui", "dialog.tsx");
const SHEET = path.resolve(SRC_ROOT, "components", "ui", "sheet.tsx");
const TOAST = path.resolve(SRC_ROOT, "components", "ui", "toast.tsx");

const styles = fs.readFileSync(STYLES, "utf8");

/**
 * Every double-quoted string literal in a component file, in source order.
 * Guards assert on token membership rather than "token appears somewhere in
 * the file", so a stray mention in a comment cannot satisfy them.
 */
function stringLiterals(file: string): string[][] {
  const src = fs.readFileSync(file, "utf8");
  return [...src.matchAll(/"([^"\n]*)"/g)].map((m) =>
    m[1].split(/\s+/).filter(Boolean),
  );
}

function listsWith(file: string, ...tokens: string[]): string[][] {
  return stringLiterals(file).filter((list) =>
    tokens.every((t) => list.includes(t)),
  );
}

/** Collapse a CSS rule body for a selector, whitespace-insensitive. */
function ruleBody(css: string, selector: string): string | null {
  const idx = css.indexOf(selector);
  if (idx === -1) return null;
  const open = css.indexOf("{", idx);
  const close = css.indexOf("}", open);
  if (open === -1 || close === -1) return null;
  return css
    .slice(open + 1, close)
    .replace(/\s+/g, " ")
    .trim();
}

/** The rule that contains `selector` anywhere in its selector list. */
function ruleContaining(css: string, selector: string): string {
  const idx = css.indexOf(selector);
  if (idx === -1) throw new Error(`selector not found: ${selector}`);
  const start = css.lastIndexOf("}", idx) + 1;
  const open = css.indexOf("{", idx);
  const close = css.indexOf("}", open);
  return css.slice(start, close + 1).replace(/\s+/g, " ");
}

describe("P0-1 Arabic typography: no Latin tracking on cursive script", () => {
  it("resets wide/narrow tracking under html[lang=ar]", () => {
    expect(styles).toContain('html[lang="ar"] .tracking-wide');
    expect(styles).toContain('html[lang="ar"] .tracking-wider');
    expect(styles).toContain('html[lang="ar"] .tracking-widest');
    expect(styles).toContain('html[lang="ar"] [class*="tracking-["]');
    // The rule actually neutralises rather than merely being mentioned.
    const body = ruleBody(styles, 'html[lang="ar"] .tracking-wide:not');
    expect(body, "tracking reset rule body").toBe("letter-spacing: 0;");
  });

  it("resets tracking for the hero eyebrow custom classes", () => {
    const body = ruleBody(
      styles,
      'html[lang="ar"] .darb-home-hero-eyebrow:not',
    );
    expect(body, "eyebrow reset rule body").toBe("letter-spacing: 0;");
    expect(styles).toContain('html[lang="ar"] .darb-page-hero-eyebrow:not');
  });

  it("keeps the Latin tracking the reset overrides (non-vacuous)", () => {
    // If someone deleted the positive tracking instead of scoping it, Latin
    // eyebrows would silently lose their intended wide tracking.
    expect(ruleBody(styles, ".darb-page-hero-eyebrow {")).toBe(
      "letter-spacing: 0.14em;",
    );
    expect(ruleBody(styles, ".darb-home-hero-eyebrow {")).toBe(
      "font-size: clamp(0.72rem, 0.72vw, 0.9rem); letter-spacing: 0.14em;",
    );
  });

  it("does NOT strip Hebrew tracking — Hebrew letters do not join", () => {
    expect(styles).not.toMatch(/html\[lang="he"\]\s+\.tracking-/);
    // ...but uppercase is still neutralised for both caseless scripts.
    const body = ruleBody(styles, 'html[lang="ar"] .uppercase:not');
    expect(body).toBe("text-transform: none;");
    expect(styles).toContain('html[lang="he"] .uppercase:not');
  });

  it("lets dir=ltr islands keep Latin tracking and uppercase", () => {
    // Regression: `:not([dir="ltr"] *)` excludes descendants of an LTR island
    // but NOT the island element itself, so a dir="ltr" span silently lost its
    // Latin tracking. Both exclusions are required.
    for (const selector of [
      'html[lang="ar"] .tracking-wide:not',
      'html[dir="rtl"] .tracking-wide:not',
      'html[lang="ar"] .uppercase:not',
      'html[dir="rtl"] .uppercase:not',
      'html[lang="ar"] [class*="tracking-["]:not',
      'html[lang="ar"] .darb-page-hero-eyebrow:not',
    ]) {
      const rule = ruleContaining(styles, selector);
      expect(rule, `${selector} rule`).toContain(':not([dir="ltr"])');
      expect(rule, `${selector} rule`).toContain(':not([dir="ltr"] *)');
      // A Hebrew run inside an Arabic page must also keep its legitimate
      // tracking, so the ar/dir=rtl tracking resets exclude it too.
      if (!selector.includes("uppercase") && !selector.includes("eyebrow")) {
        expect(rule, `${selector} rule`).toContain(':not([lang="he"])');
        expect(rule, `${selector} rule`).toContain(':not([lang="he"] *)');
      }
    }
  });
});

describe("P0-2 user preference media queries are live and valid", () => {
  it("honours prefers-reduced-transparency by dropping blur", () => {
    expect(styles).toContain("@media (prefers-reduced-transparency: reduce)");
    const idx = styles.indexOf("@media (prefers-reduced-transparency: reduce)");
    const block = styles.slice(idx, idx + 1400);
    expect(block).toContain("backdrop-filter: none !important");
    expect(block).toContain("-webkit-backdrop-filter: none !important");
    // Opaque fallbacks for the translucent chrome that uses the blur.
    expect(block).toContain(".bg-background\\/95");
    expect(block).toContain(".bg-hero-panel\\/45");
    // `html ` is load-bearing: the base scrim rule is unlayered and later in
    // the file, so equal specificity would silently win over this override.
    expect(block).toContain("html .darb-hero-scrim");
  });

  it("uses the valid prefers-contrast value and never the invalid one", () => {
    expect(styles).toContain("@media (prefers-contrast: more)");
    expect(styles).not.toContain("prefers-contrast: high");
  });

  it("declares the webkit backdrop filter BEFORE the standard one", () => {
    // Load-bearing order: Lightning CSS collapses the duplicate pair and keeps
    // only the last standard `backdrop-filter`. With the standard property
    // written first, the prefixed one won and the blur survived in Firefox —
    // i.e. the preference silently did nothing outside WebKit.
    const block = ruleContaining(styles, '[class*="backdrop-blur"]');
    const webkit = block.indexOf("-webkit-backdrop-filter");
    expect(webkit, "prefixed declaration").toBeGreaterThan(-1);
    const standard = block.indexOf("backdrop-filter", webkit + 1);
    expect(standard, "standard declaration after prefixed").toBeGreaterThan(
      webkit,
    );
  });

  it("keeps the orphaned accessibility.css deleted (documented decision)", () => {
    // docs/agent-notes.md: layouts/navigation/accessibility/animations/pwa
    // were unimported; P2-1 deleted them. Live rules must therefore live in
    // the Tailwind entry, not in a resurrected side file.
    expect(styles).not.toContain('@import "./styles/accessibility.css"');
    expect(
      fs.existsSync(path.resolve(SRC_ROOT, "styles", "accessibility.css")),
    ).toBe(false);
  });
});

describe("P0-3 close controls: logical side + >=44px hit area", () => {
  it("dialog close uses logical end and a 44px box", () => {
    const [close] = listsWith(DIALOG, "end-2", "h-11", "w-11");
    expect(close, "dialog close class list").toBeTruthy();
    expect(close).not.toContain("right-4");
  });

  it("sheet close uses logical end and a 44px box", () => {
    const [close] = listsWith(SHEET, "end-2", "h-11", "w-11");
    expect(close, "sheet close class list").toBeTruthy();
    expect(close).not.toContain("right-4");
  });

  it("toast close uses logical end and a 44px box", () => {
    const [close] = listsWith(TOAST, "end-0", "h-11", "w-11");
    expect(close, "toast close class list").toBeTruthy();
    expect(close).not.toContain("right-2");
  });

  it("toast viewport anchors to the logical end edge", () => {
    const [viewport] = listsWith(TOAST, "sm:end-0");
    expect(viewport, "toast viewport class list").toBeTruthy();
    expect(viewport).not.toContain("sm:right-0");
  });

  it("toast keeps room for the enlarged close button", () => {
    const [variants] = listsWith(TOAST, "pe-12");
    expect(variants, "toast variant class list").toBeTruthy();
    expect(variants).not.toContain("pr-8");
  });
});
