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
 * The Student Dashboard home (routed via /student-dashboard -> /student/checklist
 * -> StudentNextStepsPage -> StudentOverviewSection) used to lay its Quick
 * Actions out with `grid-cols-3` at every width below `sm`. On a phone that
 * forced three narrow cards across the viewport instead of one full-width card.
 *
 * These assertions lock in the responsive fix so the base (mobile) track count
 * cannot silently regress to a multi-column grid, and so each card is allowed
 * to shrink to its grid track rather than establishing an oversized intrinsic
 * width from a translated label.
 */
describe("Student Overview quick actions are full-width on phones", () => {
  const src = fs.readFileSync(OVERVIEW, "utf8");

  const quickActionsGrid = src.match(/className="(grid[^"]*grid-cols[^"]*)"/g) ?? [];

  it("uses a single column at the base (mobile) breakpoint", () => {
    const grid = quickActionsGrid.find((c) => c.includes("grid-cols-1"));
    expect(grid, "a grid-cols-1 base grid must exist").toBeTruthy();
    // The buggy base track count must not come back.
    expect(src).not.toMatch(/className="grid grid-cols-3 /);
    expect(src).not.toContain("grid grid-cols-3 sm:grid-cols-5");
  });

  it("keeps the sm=5 / lg=3 tablet + desktop track counts", () => {
    expect(src).toContain("grid grid-cols-1 gap-2 sm:grid-cols-5 lg:grid-cols-3");
  });

  it("lets each quick action fill and shrink within its grid track", () => {
    expect(src).toMatch(/className="flex w-full min-w-0 flex-col items-center/);
  });

  it("does not let a label establish an intrinsic width wider than its column", () => {
    expect(src).toContain("min-w-0 max-w-full break-words");
  });

  it("keeps the two-column desktop overview intact", () => {
    expect(src).toContain("grid gap-4 lg:grid-cols-2");
  });

  it("keeps the WhatsApp CTA row wrapping rather than scrolling", () => {
    expect(src).toContain("flex flex-wrap gap-2");
    expect(src).not.toContain("overflow-x-auto");
  });
});
