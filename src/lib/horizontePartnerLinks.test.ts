import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The Partner Schools page opens the DARB catalog through
 * `school_accommodations.catalog_accommodation_ids`, matched by `name_en`.
 * The HORIZONTE catalog rows live in the JSON the seed generator reads, and the
 * partner rows are seeded by SQL. Nothing at runtime ties the two name strings
 * together, so this guard fails if either side is renamed without the other:
 * a mismatch silently drops the "View in catalog" link back to
 * "Not in the DARB catalog". It also pins the CEFR level durations the level
 * calculator sums into a quote — without them HORIZONTE quoted "0 weeks".
 */

const ROOT = process.cwd();
const CATALOG = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, "src/data/schoolCatalog/accommodations.json"),
    "utf8",
  ),
) as Array<{ school: string; name_en: string }>;
const LINK_MIGRATION = fs.readFileSync(
  path.join(
    ROOT,
    "supabase/migrations/20261005180000_horizonte_catalog_links_and_levels.sql",
  ),
  "utf8",
);

describe("HORIZONTE partner catalog links", () => {
  it("links every HORIZONTE catalog housing row by its exact name", () => {
    const horizonte = CATALOG.filter((row) => row.school === "horizonte");
    expect(horizonte.length).toBe(8);
    for (const row of horizonte) {
      expect(LINK_MIGRATION).toContain(`'${row.name_en}'`);
    }
  });

  it("seeds a duration for every CEFR level the school publishes", () => {
    for (const level of ["A1", "A2", "B1", "B2", "C1", "C2"]) {
      expect(LINK_MIGRATION).toContain(`('${level}',`);
    }
  });
});
