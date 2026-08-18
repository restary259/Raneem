/**
 * A4 page geometry + scaling math for the CV Builder preview.
 *
 * The on-screen preview must reflow at exactly the same width the PDF is
 * rasterized at, so line breaks in the browser match the downloaded PDF.
 * The PDF path (html2canvas + jsPDF) captures an element fixed to the 96dpi
 * A4 width (794px). This module exposes that same width so the on-screen
 * sheet can be anchored to it and only visually scaled to fit the column.
 *
 * 210mm × 297mm at 96dpi = 794 × 1123px — the exact dimensions jsPDF's
 * `format: "a4"` produces, so a 794px-wide sheet slices perfectly into
 * 297mm-tall A4 pages.
 */

export const A4_W_PX = 794;
export const A4_H_PX = 1123;

/** Clamped so an ultra-wide column never upsizes the on-screen sheet past 1:1
 *  (the PDF is always captured at native 794px; upsizing would diverge it). */
export const MAX_SCALE = 1;

/** Scale to fit an A4-width sheet into a column width, clamped to [0, MAX_SCALE]. */
export function computeScale(wrapperWidth: number, a4Width = A4_W_PX): number {
  if (!Number.isFinite(wrapperWidth) || wrapperWidth <= 0 || a4Width <= 0) return 0;
  return Math.min(Math.max(wrapperWidth / a4Width, 0), MAX_SCALE);
}

/** Number of A4 pages the content occupies; a short CV counts as one page. */
export function pageCount(contentHeight: number, a4Height = A4_H_PX): number {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0 || a4Height <= 0) return 1;
  return Math.max(1, Math.ceil(contentHeight / a4Height));
}
