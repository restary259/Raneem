import { describe, it, expect } from "vitest";
import { A4_H_PX, A4_W_PX, MAX_SCALE, computeScale, pageCount } from "./cvLayout";

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
