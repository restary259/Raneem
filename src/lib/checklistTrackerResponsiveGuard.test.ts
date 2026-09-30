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

/** Every `className="..."` literal in the file, split into utility tokens. */
const classLists: string[][] = [...src.matchAll(/className="([^"]*)"/g)].map(
  (m) => m[1].split(/\s+/).filter(Boolean),
);

/** The first class list containing every given token. */
function classListWith(...tokens: string[]): string[] {
  const found = classLists.find((list) =>
    tokens.every((t) => list.includes(t)),
  );
  expect(
    found,
    `no className contains all of: ${tokens.join(", ")}`,
  ).toBeTruthy();
  return found!;
}

describe("Checklist progress card fits phone widths in every locale", () => {
  it("lets the text column shrink inside the fixed-ring progress row", () => {
    // the column wrapping `${title}` + progress line
    const column = classLists.find((l) => l.length === 1 && l[0] === "min-w-0");

    expect(
      column,
      "expected a `min-w-0`-only wrapper for the progress text",
    ).toBeTruthy();
  });

  it("keeps the progress ring from being squeezed by the text", () => {
    const ring = classListWith("relative", "w-24", "h-24");

    expect(ring).toContain("shrink-0");
  });

  it("wraps the card title instead of forcing the row wider", () => {
    const title = classListWith("min-w-0", "break-words");

    expect(title).toBeTruthy();
    // the leading icon must not be allowed to shrink to nothing
    const heading = classListWith("text-lg", "font-bold");
    expect(heading).toContain("gap-2");
  });

  it("never introduces horizontal scrolling", () => {
    expect(src).not.toContain("overflow-x-auto");
  });
});
