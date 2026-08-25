import type { CVDesignSettings, CVFontKey, CVSpacing } from "./types";

/**
 * Centralized CV design system — CONTENT (CVData) is separate from DESIGN
 * (these tokens) is separate from TEMPLATE (the renderer).
 *
 * Templates never hardcode colors/fonts; they read CSS custom properties emitted
 * by `designVars()` set on the preview root. Body text always stays near-black
 * for readability; the accent only colors headings, rules, the timeline and
 * small highlights — so a student's custom color can never make the CV illegible
 * or unprofessional, and it still reads well in grayscale print.
 */

export interface FontPreset {
  id: CVFontKey;
  label: string;
  stack: string;
  category: "sans" | "serif" | "mono";
}

/** Curated, professional font set — no arbitrary font uploads. */
export const FONTS: FontPreset[] = [
  { id: "inter", label: "Inter", stack: "Inter, system-ui, Arial, sans-serif", category: "sans" },
  { id: "source-sans", label: "Source Sans", stack: "'Source Sans 3', 'Source Sans Pro', Arial, sans-serif", category: "sans" },
  { id: "ibm-plex-sans", label: "IBM Plex Sans", stack: "'IBM Plex Sans', Arial, sans-serif", category: "sans" },
  { id: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif", category: "sans" },
  { id: "georgia", label: "Georgia", stack: "Georgia, 'Times New Roman', serif", category: "serif" },
  { id: "source-serif", label: "Source Serif", stack: "'Source Serif 4', 'Source Serif Pro', Georgia, serif", category: "serif" },
  { id: "merriweather", label: "Merriweather", stack: "Merriweather, Georgia, serif", category: "serif" },
  { id: "ibm-plex-mono", label: "IBM Plex Mono", stack: "'IBM Plex Mono', 'Courier New', monospace", category: "mono" },
];

export const fontStack = (id: CVFontKey): string =>
  FONTS.find((f) => f.id === id)?.stack ?? FONTS[0].stack;

export interface ColorPreset {
  id: string;
  label: string;
  accent: string;
}

/** Professional accent presets — no neon, no washed-out tints. */
export const COLOR_PRESETS: ColorPreset[] = [
  { id: "classic-black", label: "Classic Black", accent: "#1B2430" },
  { id: "navy", label: "Navy", accent: "#1F3A5F" },
  { id: "petrol", label: "Petrol", accent: "#2F6F6B" },
  { id: "forest", label: "Forest", accent: "#2F5D3A" },
  { id: "burgundy", label: "Burgundy", accent: "#6B2737" },
  { id: "slate", label: "Slate", accent: "#475569" },
  { id: "charcoal", label: "Charcoal", accent: "#33373B" },
  { id: "warm-brown", label: "Warm Brown", accent: "#6B4F3A" },
];

export interface TypographyPreset {
  id: string;
  label: string;
  font: CVFontKey;
  headingFont: CVFontKey;
  dateFont: CVFontKey;
}

export const TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  { id: "classic", label: "Classic", font: "georgia", headingFont: "georgia", dateFont: "ibm-plex-mono" },
  { id: "modern-academic", label: "Modern Academic", font: "inter", headingFont: "inter", dateFont: "ibm-plex-mono" },
  { id: "professional", label: "Professional", font: "source-sans", headingFont: "source-sans", dateFont: "ibm-plex-mono" },
  { id: "minimal", label: "Minimal", font: "inter", headingFont: "inter", dateFont: "inter" },
];

export interface DesignPreset {
  id: string;
  label: string;
  accent: string;
  font: CVFontKey;
  headingFont: CVFontKey;
  dateFont: CVFontKey;
  spacing: CVSpacing;
}

/** One-click presets combining color + typography + spacing. */
export const DESIGN_PRESETS: DesignPreset[] = [
  { id: "classic-black", label: "Classic Black", accent: "#1B2430", font: "inter", headingFont: "inter", dateFont: "ibm-plex-mono", spacing: "normal" },
  { id: "academic-navy", label: "Academic Navy", accent: "#1F3A5F", font: "georgia", headingFont: "georgia", dateFont: "ibm-plex-mono", spacing: "normal" },
  { id: "modern-petrol", label: "Modern Petrol", accent: "#2F6F6B", font: "inter", headingFont: "inter", dateFont: "ibm-plex-mono", spacing: "normal" },
  { id: "forest-academic", label: "Forest Academic", accent: "#2F5D3A", font: "source-serif", headingFont: "source-serif", dateFont: "ibm-plex-mono", spacing: "normal" },
  { id: "burgundy-academic", label: "Burgundy Academic", accent: "#6B2737", font: "merriweather", headingFont: "merriweather", dateFont: "ibm-plex-mono", spacing: "normal" },
  { id: "minimal-slate", label: "Minimal Slate", accent: "#475569", font: "inter", headingFont: "inter", dateFont: "inter", spacing: "compact" },
];

// ─── Color safety ───────────────────────────────────────────────────────────

/** Relative luminance (WCAG). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const chan = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "").match(/^([a-f0-9]{6}|[a-f0-9]{3})$/i);
  if (!m) return { r: 27, g: 36, b: 48 };
  const h = m[1];
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/**
 * Given an accent color, decide whether it is safe to use as text on white.
 * If contrast against white is < 4.5 (WCAG AA for normal text), darken it until
 * it passes — so a student who picks a light petrol still gets readable headings.
 */
export function safeAccentOnWhite(hex: string): string {
  const MIN = 4.5;
  if (contrastRatio(hex, "#FFFFFF") >= MIN) return hex;
  // Darken by mixing toward black until contrast passes.
  let { r, g, b } = hexToRgb(hex);
  for (let i = 0; i < 10; i++) {
    r = Math.round(r * 0.82);
    g = Math.round(g * 0.82);
    b = Math.round(b * 0.82);
    const candidate = rgbToHex(r, g, b);
    if (contrastRatio(candidate, "#FFFFFF") >= MIN) return candidate;
  }
  return "#1B2430";
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function isHex(v: string): boolean {
  return /^#([a-f0-9]{6}|[a-f0-9]{3})$/i.test(v.trim());
}

// ─── CSS variable resolver ───────────────────────────────────────────────────

// root is also the PDF slicer's safety margin: PDF_TRAILING_EPSILON_MM
// (cvLayout.ts) must stay below the smallest root (24px ≈ 6.4mm) so a dropped
// trailing slice can only ever contain padding, never content.
const SPACING_SCALE: Record<CVSpacing, { root: string; section: string; entry: string }> = {
  compact: { root: "24px", section: "12px", entry: "6px" },
  normal: { root: "32px", section: "16px", entry: "8px" },
  relaxed: { root: "40px", section: "22px", entry: "12px" },
};

/**
 * Resolve design settings into CSS custom properties for the preview root.
 * Templates use `var(--cv-accent)`, `var(--cv-font)`, etc.
 */
export function designVars(d: CVDesignSettings): Record<string, string> {
  const accent = safeAccentOnWhite(d.accent);
  const s = SPACING_SCALE[d.spacing] ?? SPACING_SCALE.normal;
  return {
    "--cv-accent": accent,
    "--cv-accent-soft": `${accent}14`, // very light tint for backgrounds
    "--cv-font": fontStack(d.font),
    "--cv-heading-font": fontStack(d.headingFont),
    "--cv-date-font": fontStack(d.dateFont),
    "--cv-spacing-root": s.root,
    "--cv-spacing-section": s.section,
    "--cv-spacing-entry": s.entry,
    "--cv-body-color": "#1a1a1a",
    "--cv-muted": "#5b6472",
    "--cv-rule": "#d6d3ce",
  };
}

export function applyPreset(id: string): Partial<CVDesignSettings> {
  const p = DESIGN_PRESETS.find((x) => x.id === id);
  if (!p) return {};
  return {
    accent: p.accent,
    font: p.font,
    headingFont: p.headingFont,
    dateFont: p.dateFont,
    spacing: p.spacing,
    preset: p.id,
  };
}

export function applyTypographyPreset(id: string): Partial<CVDesignSettings> {
  const p = TYPOGRAPHY_PRESETS.find((x) => x.id === id);
  if (!p) return {};
  return { font: p.font, headingFont: p.headingFont, dateFont: p.dateFont };
}
