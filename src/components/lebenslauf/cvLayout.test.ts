import { describe, it, expect } from "vitest";
import { A4_H_MM, A4_H_PX, A4_W_PX, MAX_SCALE, computeEntryShifts, computeScale, pageCount, slicePageCount, PDF_TRAILING_EPSILON_MM } from "./cvLayout";

describe("cvLayout A4 geometry", () => {
  it("exposes the 96dpi A4 pixel dimensions (210mm × 297mm)", () => {
    // 210mm * 96dpi / 25.4mm/in = 793.7… → 794 (CSS whole-pixel A4 width).
    // 297mm * 96dpi / 25.4mm/in = 1122.5… → 1123 (A4 height).
    expect(A4_W_PX).toBe(794);
    expect(A4_H_PX).toBe(1123);
  });

  it("caps the scale so an ultra-wide column never upscales past 1:1", () => {
    expect(MAX_SCALE).toBe(1);
    // A wrapper wider than the A4 sheet stays at native 1:1 — oversizing the
    // on-screen copy would only diverge it from the PDF (captured at 794px).
    expect(computeScale(1200)).toBe(1);
    expect(computeScale(794)).toBe(1);
    expect(computeScale(10_000)).toBe(1);
  });

  it("shrinks proportionally when the column is narrower than A4", () => {
    expect(computeScale(397)).toBeCloseTo(0.5, 5); // half-width → half scale
    expect(computeScale(794 / 3)).toBeCloseTo(1 / 3, 5);
    // The on-screen width (scale * 794) always equals the wrapper width, so
    // the sheet is fully visible without horizontal scrollbars.
    expect(computeScale(300) * A4_W_PX).toBeCloseTo(300, 5);
  });

  it("is robust to degenerate / non-finite inputs (no NaN/Infinity transform)", () => {
    expect(computeScale(0)).toBe(0);
    expect(computeScale(-100)).toBe(0);
    expect(computeScale(Number.NaN)).toBe(0);
    // A non-finite width is nonsensical, not "very wide" — both helpers use
    // the same isFinite guard so an Infinity width/height fall to the default.
    expect(computeScale(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("counts a short CV as a single page and paginates long content", () => {
    // A short CV still occupies one A4 page (the sheet has minHeight A4_H_PX).
    expect(pageCount(0)).toBe(1);
    expect(pageCount(100)).toBe(1);
    expect(pageCount(A4_H_PX)).toBe(1);
    // Content just past one page → two pages.
    expect(pageCount(A4_H_PX + 1)).toBe(2);
    expect(pageCount(A4_H_PX * 2)).toBe(2);
    expect(pageCount(A4_H_PX * 2 + 1)).toBe(3);
    // Degenerate height falls back to one page, never zero.
    expect(pageCount(Number.NaN)).toBe(1);
    expect(pageCount(-50)).toBe(1);
  });

  it("the on-screen width invariant holds: scale*A4_W_PX == wrapperWidth (≤ A4)", () => {
    // For any column narrower than A4, the visible sheet width equals the
    // column width — this is what makes on-screen line breaks match print.
    for (const w of [200, 400, 600, 793]) {
      expect(computeScale(w) * A4_W_PX).toBeCloseTo(w, 5);
    }
  });
});

describe("computeEntryShifts (PDF page-break shifts)", () => {
  it("leaves entries fully inside a page untouched", () => {
    expect(computeEntryShifts([{ top: 100, height: 50 }])).toEqual([0]);
    // Ends exactly on the boundary → still fits, no shift.
    expect(computeEntryShifts([{ top: A4_H_PX - 50, height: 50 }])).toEqual([0]);
    // Starts exactly on a boundary → no shift.
    expect(computeEntryShifts([{ top: A4_H_PX, height: 50 }])).toEqual([0]);
  });

  it("pushes an entry straddling a page boundary wholly onto the next page", () => {
    const shifts = computeEntryShifts([{ top: A4_H_PX - 10, height: 50 }]);
    expect(shifts).toEqual([10]);
    // After the shift the entry occupies [A4_H_PX, A4_H_PX + 50] — page 2.
    expect(A4_H_PX - 10 + shifts[0]).toBe(A4_H_PX);
  });

  it("never shifts an entry at least one page tall (it cannot fit anyway)", () => {
    expect(computeEntryShifts([{ top: 100, height: A4_H_PX }])).toEqual([0]);
    expect(computeEntryShifts([{ top: 100, height: A4_H_PX * 2 }])).toEqual([0]);
  });

  it("accumulates shifts so later entries are re-measured against moved content", () => {
    // Entry 0 straddles page 1 → shifted 10px to page 2. Entry 1 would fit on
    // page 2 at its original top, but the +10px push moves it over the page-2
    // boundary, so it must shift too.
    const shifts = computeEntryShifts([
      { top: A4_H_PX - 10, height: 50 },   // → shift 10, lands on page 2
      { top: 2 * A4_H_PX - 15, height: 50 }, // +10 → straddles page 2 → shift 5
      { top: 2 * A4_H_PX + 100, height: 50 }, // +15 → comfortably on page 3
    ]);
    expect(shifts).toEqual([10, 5, 0]);
    // Final positions: every entry fully inside a page.
    let offset = 0;
    [
      { top: A4_H_PX - 10, height: 50 },
      { top: 2 * A4_H_PX - 15, height: 50 },
      { top: 2 * A4_H_PX + 100, height: 50 },
    ].forEach((box, i) => {
      offset += shifts[i];
      const top = box.top + offset;
      const pageEnd = (Math.floor(top / A4_H_PX) + 1) * A4_H_PX;
      expect(top + box.height).toBeLessThanOrEqual(pageEnd);
    });
  });

  it("is robust to degenerate / non-finite inputs (no shift)", () => {
    expect(computeEntryShifts([{ top: 0, height: 0 }])).toEqual([0]);
    expect(computeEntryShifts([{ top: Number.NaN, height: 50 }])).toEqual([0]);
    expect(computeEntryShifts([{ top: 100, height: Number.NaN }])).toEqual([0]);
    expect(computeEntryShifts([{ top: 100, height: -5 }])).toEqual([0]);
    expect(computeEntryShifts([])).toEqual([]);
    // A non-positive page height is nonsensical → nothing shifts.
    expect(computeEntryShifts([{ top: 100, height: 50 }], 0)).toEqual([0]);
    expect(computeEntryShifts([{ top: 100, height: 50 }], Number.NaN)).toEqual([0]);
  });
});

describe("slicePageCount (PDF trailing-page epsilon)", () => {
  it("counts short content as a single page", () => {
    expect(slicePageCount(0)).toBe(1);
    expect(slicePageCount(100)).toBe(1);
    expect(slicePageCount(A4_H_MM)).toBe(1);
  });

  it("drops a trailing slice shorter than the epsilon (near-blank page)", () => {
    // Content ending 4mm (≈15px) past a boundary → only bottom padding in the
    // slice → dropped. Matches the pre-refactor while-loop semantics.
    expect(slicePageCount(A4_H_MM + 4)).toBe(1);
    expect(slicePageCount(2 * A4_H_MM + 4)).toBe(2);
  });

  it("keeps a trailing slice longer than the epsilon", () => {
    expect(slicePageCount(A4_H_MM + 6)).toBe(2);
    expect(slicePageCount(2 * A4_H_MM + 6)).toBe(3);
  });

  it("treats content ending exactly at the epsilon boundary as droppable", () => {
    expect(slicePageCount(A4_H_MM + PDF_TRAILING_EPSILON_MM)).toBe(1);
    expect(slicePageCount(A4_H_MM + PDF_TRAILING_EPSILON_MM + 0.1)).toBe(2);
  });

  it("is robust to degenerate / non-finite inputs (one page)", () => {
    expect(slicePageCount(Number.NaN)).toBe(1);
    expect(slicePageCount(-50)).toBe(1);
  });
});
