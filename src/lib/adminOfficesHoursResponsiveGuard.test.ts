import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");
const PAGE = path.resolve(SRC_ROOT, "pages", "admin", "AdminOfficesPage.tsx");

/**
 * Admin → Offices → edit dialog → "Working hours".
 *
 * The day row is a grid whose third cell holds two native
 * `input[type=time]` controls. A grid item defaults to `min-width: auto`,
 * which for a native time control is its browser-dependent intrinsic width
 * (Chrome ~112px, but much wider on other engines/versions). Nothing capped
 * that, so on a browser with a wide time control the two inputs could not
 * shrink into their `grid-cols-2` tracks and overflowed the row, overlapping
 * each other. Reproduced in Chromium with a 230px intrinsic width: the row
 * overflowed at 360/400/480px (mobile) and only fit from ~560px up.
 *
 * The fix gives the controls an explicit shrink allowance (`min-w-0` on each
 * input and on their wrapping grid) and makes the desktop times track
 * `minmax(0,1fr)` so the whole row can shrink instead of forcing width. The
 * row keeps an explicit base track so it never falls back to an implicit
 * `auto` track (the documented trap elsewhere in this codebase).
 */
const src = fs.readFileSync(PAGE, "utf8");

/**
 * Every `className="..."` literal in source order, so guards anchor on an
 * element's POSITION rather than merely proving a token exists somewhere in
 * the file (a bare `min-w-0` anywhere would be vacuous).
 */
const classLists: string[][] = [...src.matchAll(/className="([^"]*)"/g)].map(
  (m) => m[1].split(/\s+/).filter(Boolean),
);

/** Index of the first class list containing every given token. */
function indexWith(...tokens: string[]): number {
  const i = classLists.findIndex((list) =>
    tokens.every((t) => list.includes(t)),
  );
  expect(
    i,
    `no className contains all of: ${tokens.join(", ")}`,
  ).toBeGreaterThanOrEqual(0);
  return i;
}

/** The first class list AFTER `from` that contains every given token. */
function nextClassListAfter(
  from: number,
  ...tokens: string[]
): { index: number; list: string[] } {
  const index = classLists.findIndex(
    (list, idx) => idx > from && tokens.every((t) => list.includes(t)),
  );
  expect(
    index,
    `no className after index ${from} contains: ${tokens.join(", ")}`,
  ).toBeGreaterThan(from);
  return { index, list: classLists[index] };
}

describe("Admin offices working-hours row fits narrow widths", () => {
  it("keeps an explicit base track (never an implicit auto track)", () => {
    const row = classLists[indexWith("sm:grid-cols-[7rem_auto_minmax(0,1fr)]")];

    // A base `grid-cols-*` is required: a bare `grid` makes one implicit
    // `auto` track that sizes to the widest item's min-content.
    expect(row).toContain("grid-cols-[1fr_auto]");
    // The old desktop track used a bare `1fr` for the times cell, which let a
    // wide time control force the row wider instead of shrinking.
    expect(row).not.toContain("sm:grid-cols-[7rem_auto_1fr]");
  });

  it("gives the two time inputs an explicit shrink allowance", () => {
    const times = indexWith("sm:col-span-1", "grid-cols-2");
    const firstInput = nextClassListAfter(times, "min-w-0");

    expect(firstInput.list).toEqual(["min-w-0"]);
    // Both controls, not just the first.
    const secondInput = nextClassListAfter(firstInput.index, "min-w-0");
    expect(secondInput.list).toEqual(["min-w-0"]);
  });

  it("lets the times wrapper shrink inside its grid cell", () => {
    const times = classLists[indexWith("sm:col-span-1", "grid-cols-2")];

    expect(times).toContain("min-w-0");
  });

  it("does not hide the overflow behind horizontal scrolling", () => {
    expect(src).not.toContain("overflow-x-auto");
  });
});
