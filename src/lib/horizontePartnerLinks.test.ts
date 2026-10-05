import { describe, it, expect } from "vitest";
import fs, { readFileSync, existsSync } from "node:fs";
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

  it("resolves the catalog school by slug so a late catalog insert still links", () => {
    // The link must not depend on partner_schools.catalog_school_id, which can
    // be NULL when the catalog school row was inserted after the partner seed.
    expect(LINK_MIGRATION).toContain("ps.catalog_school_id IS DISTINCT FROM s.id");
    expect(LINK_MIGRATION).toContain("s.slug = 'horizonte'");
    expect(LINK_MIGRATION).toMatch(/RAISE WARNING/);
  });
});

describe("HORIZONTE catalog photos", () => {
  const ROOT = path.resolve(process.cwd());
  const PHOTO_MIGRATION = readFileSync(
    path.join(ROOT, "supabase/migrations/20261005190000_horizonte_school_and_housing_photos.sql"),
    "utf8",
  );
  const schools = JSON.parse(readFileSync(path.join(ROOT, "src/data/schoolCatalog/schools.json"), "utf8"));
  const accommodations = JSON.parse(
    readFileSync(path.join(ROOT, "src/data/schoolCatalog/accommodations.json"), "utf8"),
  );

  it("declares a school photo for HORIZONTE", () => {
    const school = schools.find((s: { slug: string }) => s.slug === "horizonte");
    expect(school?.photos?.length ?? 0).toBeGreaterThan(0);
  });

  it("references only photo files that exist under public/", () => {
    const paths: string[] = [
      ...(schools.find((s: { slug: string }) => s.slug === "horizonte")?.photos ?? []),
      ...accommodations.filter((a: { school: string }) => a.school === "horizonte").flatMap((a: { photos?: string[] }) => a.photos ?? []),
    ];
    for (const p of paths) {
      expect(existsSync(path.join(ROOT, "public", p)), `${p} is missing on disk`).toBe(true);
    }
  });

  it("sets the school photo in the migration to the declared hero", () => {
    const hero = schools.find((s: { slug: string }) => s.slug === "horizonte")?.photos?.[0];
    expect(hero).toBeTruthy();
    expect(PHOTO_MIGRATION).toContain(hero as string);
  });
});
