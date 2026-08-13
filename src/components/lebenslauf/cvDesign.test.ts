import { describe, it, expect } from "vitest";
import {
  COLOR_PRESETS,
  DESIGN_PRESETS,
  TYPOGRAPHY_PRESETS,
  FONTS,
  contrastRatio,
  luminance,
  safeAccentOnWhite,
  hexToRgb,
  isHex,
  designVars,
  applyPreset,
  applyTypographyPreset,
  fontStack,
} from "./cvDesign";
import { createEmptyCVData, DEFAULT_DESIGN } from "./types";
import type { CVFontKey } from "./types";

describe("cvDesign", () => {
  describe("color safety", () => {
    it("passes through a dark accent that already meets AA on white", () => {
      // Classic black / navy already have high contrast on white.
      expect(safeAccentOnWhite("#1B2430")).toBe("#1B2430");
      expect(safeAccentOnWhite("#1F3A5F")).toBe("#1F3A5F");
    });

    it("darkens a too-light accent until it passes WCAG AA (>=4.5)", () => {
      // A washed-out light petrol would normally fail on white.
      const fixed = safeAccentOnWhite("#9FE3DF");
      expect(contrastRatio(fixed, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    });

    it("never returns a color that fails AA on white", () => {
      for (const p of COLOR_PRESETS) {
        const safe = safeAccentOnWhite(p.accent);
        expect(contrastRatio(safe, "#FFFFFF"), `${p.label} (${p.accent})`).toBeGreaterThanOrEqual(4.5);
      }
      // A battery of custom light colors too.
      for (const hex of ["#FFDDDD", "#E0E0E0", "#AABBCC", "#88AA88"]) {
        const safe = safeAccentOnWhite(hex);
        expect(contrastRatio(safe, "#FFFFFF"), hex).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("luminance of white is ~1 and black is ~0", () => {
      expect(luminance("#FFFFFF")).toBeCloseTo(1, 1);
      expect(luminance("#000000")).toBeCloseTo(0, 1);
    });

    it("contrastRatio(black, white) ≈ 21", () => {
      expect(contrastRatio("#000000", "#FFFFFF")).toBeGreaterThan(20);
    });

    it("hexToRgb parses 6-digit and 3-digit hex, falls back gracefully", () => {
      expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb("#000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb("not-a-color")).toEqual({ r: 27, g: 36, b: 48 });
    });

    it("isHex validates hex strings", () => {
      expect(isHex("#FFFFFF")).toBe(true);
      expect(isHex("#fff")).toBe(true);
      expect(isHex("#GGGGGG")).toBe(false);
      expect(isHex("FFFFFF")).toBe(false);
    });
  });

  describe("designVars", () => {
    it("emits CSS custom properties including a safe accent", () => {
      const vars = designVars({ ...DEFAULT_DESIGN, accent: "#9FE3DF" });
      expect(vars["--cv-accent"]).toBeDefined();
      expect(contrastRatio(vars["--cv-accent"], "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(vars["--cv-font"]).toContain("Inter");
      expect(vars["--cv-heading-font"]).toBeTruthy();
      expect(vars["--cv-date-font"]).toContain("Plex Mono");
      expect(vars["--cv-spacing-root"]).toMatch(/px/);
    });

    it("maps spacing presets to distinct root paddings", () => {
      const compact = designVars({ ...DEFAULT_DESIGN, spacing: "compact" });
      const normal = designVars({ ...DEFAULT_DESIGN, spacing: "normal" });
      const relaxed = designVars({ ...DEFAULT_DESIGN, spacing: "relaxed" });
      expect(Number(compact["--cv-spacing-root"].replace("px", ""))).toBeLessThan(Number(normal["--cv-spacing-root"].replace("px", "")));
      expect(Number(normal["--cv-spacing-root"].replace("px", ""))).toBeLessThan(Number(relaxed["--cv-spacing-root"].replace("px", "")));
    });
  });

  describe("presets", () => {
    it("applyPreset returns the matching color/fonts/spacing", () => {
      const patch = applyPreset("academic-navy");
      expect(patch.accent).toBe("#1F3A5F");
      expect(patch.preset).toBe("academic-navy");
    });

    it("applyPreset returns {} for unknown id", () => {
      expect(applyPreset("does-not-exist")).toEqual({});
    });

    it("applyTypographyPreset sets the three font keys", () => {
      const patch = applyTypographyPreset("classic");
      expect(patch.font).toBe("georgia");
      expect(patch.headingFont).toBe("georgia");
      expect(patch.dateFont).toBe("ibm-plex-mono");
    });

    it("every design preset accent passes AA on white after safety", () => {
      for (const p of DESIGN_PRESETS) {
        expect(contrastRatio(safeAccentOnWhite(p.accent), "#FFFFFF"), p.label).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("fontStack falls back to the first font for unknown keys", () => {
      expect(fontStack("not-a-font" as CVFontKey)).toBe(FONTS[0].stack);
    });

    it("typography presets reference only known font keys", () => {
      const ids = new Set(FONTS.map((f) => f.id));
      for (const p of TYPOGRAPHY_PRESETS) {
        expect(ids.has(p.font), p.id).toBe(true);
        expect(ids.has(p.headingFont), p.id).toBe(true);
        expect(ids.has(p.dateFont), p.id).toBe(true);
      }
    });
  });

  describe("createEmptyCVData shape", () => {
    it("has all sections in canonical order and a default design", () => {
      const d = createEmptyCVData();
      expect(d.sectionOrder.length).toBe(10);
      expect(d.design).toEqual(DEFAULT_DESIGN);
      expect(d.signature.mode).toBe("none");
      expect(Array.isArray(d.projects)).toBe(true);
      expect(Array.isArray(d.awards)).toBe(true);
      expect(d.skills.interests).toEqual([]);
    });
  });
});
