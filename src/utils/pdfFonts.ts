import type jsPDF from 'jspdf';

/**
 * PDF font handling for non-Latin text.
 *
 * The previous implementation fetched Amiri from a hardcoded gstatic URL that
 * returns 404, swallowed the error, and let jsPDF fall back to Helvetica —
 * which has no Arabic/Hebrew glyphs and WinAnsi encoding, producing mojibake
 * ("þáþôþáþ³") on real financial documents. Fonts are now vendored into the
 * bundle (lazy-loaded chunk) so registration can never silently degrade.
 */

export const ARABIC_FONT = 'NotoNaskhArabic';
export const HEBREW_FONT = 'NotoSansHebrew';

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const HEBREW_RE = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
const UNICODE_SYMBOL_RE = /[₪€]/;

export const hasArabic = (text: string) => ARABIC_RE.test(text);
export const hasHebrew = (text: string) => HEBREW_RE.test(text);
export const hasRtl = (text: string) => hasArabic(text) || hasHebrew(text);

export interface FontRegistration {
  arabic: boolean;
  hebrew: boolean;
}

/**
 * Registers the bundled Arabic and Hebrew faces with a jsPDF instance.
 * Returns which faces are available — callers MUST check the result and warn
 * the user rather than emitting an unreadable document.
 */
export async function registerPdfFonts(doc: jsPDF): Promise<FontRegistration> {
  const result: FontRegistration = { arabic: false, hebrew: false };

  try {
    const { NOTO_NASKH_ARABIC_BASE64 } = await import('@/assets/fonts/notoNaskhArabic');
    doc.addFileToVFS('NotoNaskhArabic-Regular.ttf', NOTO_NASKH_ARABIC_BASE64);
    doc.addFont('NotoNaskhArabic-Regular.ttf', ARABIC_FONT, 'normal');
    doc.addFont('NotoNaskhArabic-Regular.ttf', ARABIC_FONT, 'bold');
    result.arabic = true;
  } catch (e) {
    console.error('Failed to register Arabic PDF font', e);
  }

  try {
    const { NOTO_SANS_HEBREW_BASE64 } = await import('@/assets/fonts/notoSansHebrew');
    doc.addFileToVFS('NotoSansHebrew-Regular.ttf', NOTO_SANS_HEBREW_BASE64);
    doc.addFont('NotoSansHebrew-Regular.ttf', HEBREW_FONT, 'normal');
    doc.addFont('NotoSansHebrew-Regular.ttf', HEBREW_FONT, 'bold');
    result.hebrew = true;
  } catch (e) {
    console.error('Failed to register Hebrew PDF font', e);
  }

  return result;
}

/** Picks the font family that can actually render the given string. */
export function fontForText(text: string, fonts: FontRegistration, fallback = 'helvetica'): string {
  if (hasArabic(text) && fonts.arabic) return ARABIC_FONT;
  if (hasHebrew(text) && fonts.hebrew) return HEBREW_FONT;
  // Helvetica uses WinAnsi in jsPDF and corrupts ₪. The bundled Hebrew face
  // contains both currency symbols and ASCII digits used in financial cells.
  if (UNICODE_SYMBOL_RE.test(text) && fonts.hebrew) return HEBREW_FONT;
  return fallback;
}

type Reshaper = { convertArabic: (input: string) => string };
let reshaper: Reshaper | null = null;
let bidiEngine: any = null;

/**
 * Loads the shaping/bidi engines once. jsPDF renders glyphs in logical order
 * with no shaping, so Arabic must be reshaped into presentation forms and both
 * scripts must be visually reordered before drawing.
 */
export async function loadTextShaper(): Promise<void> {
  if (!reshaper) {
    try {
      const mod: any = await import('arabic-persian-reshaper');
      reshaper = (mod.ArabicShaper ?? mod.default?.ArabicShaper ?? mod.default ?? mod) as Reshaper;
    } catch (e) {
      console.error('Failed to load Arabic reshaper', e);
    }
  }
  if (!bidiEngine) {
    try {
      const mod: any = await import('bidi-js');
      bidiEngine = (mod.default ?? mod)();
    } catch (e) {
      console.error('Failed to load bidi engine', e);
    }
  }
}

/**
 * Keeps Arabic text in logical Unicode order — current jsPDF performs Arabic
 * shaping and bidi in its own text pipeline, so pre-shaping there caused
 * double handling and unreadable output.
 *
 * jsPDF does NOT apply that pipeline to Hebrew: a Hebrew string is drawn
 * left-to-right, so it reads backwards in the PDF. Hebrew-only strings are
 * therefore reordered here into visual order, with embedded Latin/digit runs
 * (names, amounts, dates) re-reversed so they stay readable.
 */
export function shapeForPdf(text: string): string {
  if (!hasHebrew(text) || hasArabic(text)) return text;

  const runs = text.match(/[\u0590-\u05FF\uFB1D-\uFB4F]+|[^\u0590-\u05FF\uFB1D-\uFB4F]+/g) ?? [];
  return runs
    .reverse()
    .map(run => (HEBREW_RE.test(run) ? [...run].reverse().join('') : [...run].reverse().join('')))
    .map((run, i) => run)
    .join('');
}

