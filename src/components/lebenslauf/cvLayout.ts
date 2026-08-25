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

import { MIN_ROOT_PADDING_PX } from "./cvDesign";

export const A4_W_PX = 794;
export const A4_H_PX = 1123;

/** CSS px per mm at the 96dpi reference the A4 pixel dims above use. */
export const PX_PER_MM = 96 / 25.4;

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

/** A4 height in mm — the unit jsPDF slices the rasterized image in. */
export const A4_H_MM = 297;

/**
 * Trailing-page epsilon for the PDF slicer: a final slice shorter than this
 * is dropped as a near-blank page. DERIVED (not merely documented) from the
 * smallest template bottom padding (MIN_ROOT_PADDING_PX), so a dropped slice
 * can only ever contain padding, never content — if the spacing scale ever
 * shrinks, the epsilon shrinks with it instead of silently truncating entries.
 * Floor of 1mm keeps it meaningful.
 */
export const PDF_TRAILING_EPSILON_MM = Math.max(1, MIN_ROOT_PADDING_PX / PX_PER_MM - 1);

/**
 * Number of A4 pages the rasterized CV image is sliced into. A trailing slice
 * shorter than epsilonMm is dropped (it can only contain the templates'
 * bottom padding — see PDF_TRAILING_EPSILON_MM). Degenerate input → one page.
 */
export function slicePageCount(imgHeightMm: number, pageHeightMm = A4_H_MM, epsilonMm = PDF_TRAILING_EPSILON_MM): number {
  if (!Number.isFinite(imgHeightMm) || imgHeightMm <= 0 || pageHeightMm <= 0) return 1;
  return Math.max(1, Math.ceil((imgHeightMm - epsilonMm) / pageHeightMm));
}

export interface EntryBox {
  /** Distance from the top of the captured sheet, in CSS px. */
  top: number;
  height: number;
}

/**
 * Page-break shifts for the PDF capture: walks entries in document order with
 * a cumulative offset; when an entry (shorter than a page) straddles a page
 * boundary, returns the shift needed to push it wholly onto the next page.
 * Entries at least one page tall can never fit on a single page, so they are
 * never shifted. Degenerate measurements (NaN, non-positive height) shift 0.
 */
export function computeEntryShifts(entries: EntryBox[], pageHeight = A4_H_PX): number[] {
  const shifts = entries.map(() => 0);
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) return shifts;
  let offset = 0;
  entries.forEach(({ top, height }, i) => {
    if (!Number.isFinite(top) || !Number.isFinite(height) || height <= 0 || height >= pageHeight) return;
    const shiftedTop = top + offset;
    const pageEnd = (Math.floor(shiftedTop / pageHeight) + 1) * pageHeight;
    if (shiftedTop + height > pageEnd) {
      const shift = pageEnd - shiftedTop;
      shifts[i] = shift;
      offset += shift;
    }
  });
  return shifts;
}
