import { describe, it, expect } from "vitest";
import { migrateDraft } from "./useLebenslauf";
import { ALL_SECTIONS, CVSectionKey } from "./types";

describe("migrateDraft sectionOrder merge", () => {
  it("appends sections missing from an old stored order, preserving stored order first", () => {
    // A draft saved when fewer sections existed (e.g. before projects/awards).
    const stored: CVSectionKey[] = ["experience", "education", "skills"];
    const merged = migrateDraft({ sectionOrder: stored });
    expect(merged.sectionOrder.slice(0, stored.length)).toEqual(stored);
    // Every current section is present exactly once — newer keys are appended
    // so they still render and remain reorderable.
    expect(new Set(merged.sectionOrder)).toEqual(new Set(ALL_SECTIONS));
    expect(merged.sectionOrder).toHaveLength(ALL_SECTIONS.length);
  });

  it("drops unknown keys but keeps every known section reachable", () => {
    const merged = migrateDraft({ sectionOrder: ["awards", "bogus-key", "summary"] });
    expect(merged.sectionOrder).not.toContain("bogus-key");
    expect(merged.sectionOrder.slice(0, 2)).toEqual(["awards", "summary"]);
    expect(new Set(merged.sectionOrder)).toEqual(new Set(ALL_SECTIONS));
  });

  it("falls back to the canonical order when nothing usable is stored", () => {
    expect(migrateDraft({}).sectionOrder).toEqual([...ALL_SECTIONS]);
    expect(migrateDraft(null).sectionOrder).toEqual([...ALL_SECTIONS]);
    expect(migrateDraft({ sectionOrder: "not-an-array" }).sectionOrder).toEqual([...ALL_SECTIONS]);
    expect(migrateDraft({ sectionOrder: [] }).sectionOrder).toEqual([...ALL_SECTIONS]);
  });

  it("keeps a complete stored order unchanged", () => {
    const reversed = [...ALL_SECTIONS].reverse();
    expect(migrateDraft({ sectionOrder: reversed }).sectionOrder).toEqual(reversed);
  });
});
