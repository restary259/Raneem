import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");
const TRACKER = path.resolve(
  SRC_ROOT,
  "components",
  "dashboard",
  "ChecklistTracker.tsx",
);

/**
 * The checklist progress card is the `/student-dashboard` target (which
 * redirects to `/student/checklist`). Its progress row is a fixed 96px ring plus
 * a translated sentence: `flex items-center gap-6`. A flex child defaults to
 * `min-width: auto`, so the text column refused to shrink to the card and the
 * row clipped its contents at 320px in the longer locales (English/Hebrew) while
 * the shorter Arabic string fit. The card is `overflow-hidden`, so the failure
 * is silent clipping rather than page scroll — which is why it needs an explicit
 * shrink allowance rather than relying on the shell's `overflow-x-hidden`.
 */
const src = fs.readFileSync(TRACKER, "utf8");

/**
 * Every `className="..."` literal in the file, in source order, so a guard can
 * anchor on the element's POSITION rather than merely proving the token exists
 * somewhere in the file. Accepting a bare `min-w-0` anywhere would pass even if
 * it sat on an unrelated element and the progress column lost it.
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

describe("Checklist progress card fits phone widths in every locale", () => {
  it("lets the text column shrink inside the fixed-ring progress row", () => {
    // The shrink allowance must be on the column that wraps the title — the
    // element IMMEDIATELY before the heading. A bare `min-w-0` anywhere in the
    // file is not enough: it could sit on an unrelated element while this
    // column loses it and the translated progress sentence clips again.
    const heading = indexWith("text-lg", "font-bold", "flex", "items-center");

    expect(classLists[heading - 1]).toEqual(["min-w-0"]);
  });

  it("keeps the progress ring from being squeezed by the text", () => {
    const ring = classLists[indexWith("relative", "w-24", "h-24")];

    expect(ring).toContain("shrink-0");
  });

  it("wraps the card title instead of forcing the row wider", () => {
    // The title span must carry the wrap allowance AND live inside the heading
    // (so it is inside the shrunk column), not elsewhere in the file.
    const heading = indexWith("text-lg", "font-bold", "flex", "items-center");
    const title = nextClassListAfter(heading, "break-words");

    expect(title.list).toContain("min-w-0");
    expect(title.index).toBeLessThanOrEqual(heading + 3);
  });

  it("never introduces horizontal scrolling", () => {
    expect(src).not.toContain("overflow-x-auto");
  });
});
