import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");
const OVERVIEW = path.resolve(
  SRC_ROOT,
  "components",
  "student",
  "StudentOverviewSection.tsx",
);

/**
 * The Student Overview (`StudentOverviewSection`, rendered by
 * `StudentNextStepsPage` at the `/student/` route; `/student-dashboard` is a
 * separate redirect to `/student/checklist`) used to lay its Quick Actions out
 * with `grid-cols-3` at every width below `sm`. On a phone that forced three
 * narrow cards across the viewport instead of one full-width card.
 *
 * These assertions resolve the effective Tailwind classes from the class list
 * rather than matching an exact string, so reordering utilities (which does not
 * change the rendered result) still passes, while a second unprefixed
 * `grid-cols-*` — the actual regression that would re-narrow the cards — fails.
 * Layout itself is verified separately by measuring the emitted stylesheet in a
 * browser; this guard is the cheap, deterministic half of that contract.
 */
const src = fs.readFileSync(OVERVIEW, "utf8");

/** Every `className="..."` literal in the file, split into utility tokens. */
const classLists: string[][] = [...src.matchAll(/className="([^"]*)"/g)].map(
  (m) => m[1].split(/\s+/).filter(Boolean),
);

/** The first class list containing every given token. */
function classListWith(...tokens: string[]): string[] {
  const found = classLists.find((list) => tokens.every((t) => list.includes(t)));
  expect(found, `no className contains all of: ${tokens.join(", ")}`).toBeTruthy();
  return found!;
}

const GRID_COLS = /^(?:(sm|md|lg|xl|2xl):)?grid-cols-(\d+)$/;

/**
 * Tailwind grid track counts keyed by the breakpoint they apply at. `base` is
 * the unprefixed utility — the one that governs phones below `sm`.
 */
function gridTracks(list: string[]): Record<string, string[]> {
  const byBreakpoint: Record<string, string[]> = {};
  for (const token of list) {
    const m = token.match(GRID_COLS);
    if (!m) continue;
    const bp = m[1] ?? "base";
    (byBreakpoint[bp] ??= []).push(m[2]);
  }
  return byBreakpoint;
}

describe("Student Overview quick actions are full-width on phones", () => {
  it("uses a single, unambiguous column count at the base (mobile) breakpoint", () => {
    const tracks = gridTracks(classListWith("grid-cols-1", "sm:grid-cols-5"));

    // Exactly one unprefixed grid-cols: two would be order-dependent, and the
    // buggy `grid-cols-3` base would land here instead of `1`.
    expect(tracks.base).toEqual(["1"]);
  });

  it("keeps the sm=5 / lg=3 tablet + desktop track counts", () => {
    const tracks = gridTracks(classListWith("grid-cols-1", "sm:grid-cols-5"));

    expect(tracks.sm).toEqual(["5"]);
    expect(tracks.lg).toEqual(["3"]);
  });

  it("lets each quick action fill and shrink within its grid track", () => {
    const button = classListWith("flex-col", "items-center", "gap-1.5");

    expect(button).toContain("w-full");
    expect(button).toContain("min-w-0");
  });

  it("does not let a label establish an intrinsic width wider than its column", () => {
    const label = classListWith("text-[11px]", "font-medium", "leading-tight");

    expect(label).toContain("min-w-0");
    expect(label).toContain("max-w-full");
    expect(label).toContain("break-words");
  });

  it("keeps the two-column desktop overview intact", () => {
    const overview = classListWith("gap-4", "lg:grid-cols-2");

    expect(overview).toContain("grid");
    expect(gridTracks(overview).base).toBeUndefined();
  });

  it("keeps the WhatsApp CTA row wrapping rather than scrolling", () => {
    const row = classListWith("flex-wrap", "gap-2");

    expect(row).toContain("flex");
    expect(src).not.toContain("overflow-x-auto");
  });
});
