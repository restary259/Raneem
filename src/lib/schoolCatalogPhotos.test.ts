import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Catalog photos are authored in src/data/schoolCatalog/*.json and compiled into
 * 20260820000000_school_catalog_seed.sql. A row with an empty `photos` array
 * renders the grey "no photo" placeholder, so this guard pins that every school
 * and accommodation row has at least one photo and that the file exists.
 *
 * It also pins the ownership boundary for HORIZONTE: the photo-link migration
 * shares the timestamp 20261005190000 with the housing-photos migration, so it
 * runs AFTER it alphabetically. If it writes `photos` it silently overwrites the
 * school's dedicated hero.jpg (which is exactly what shipped once).
 */

const ROOT = process.cwd();
const MIGRATIONS = path.join(ROOT, "supabase/migrations");
const read = (name: string) =>
  JSON.parse(
    fs.readFileSync(path.join(ROOT, "src/data/schoolCatalog", name), "utf8"),
  ) as Array<{
    name_en?: string;
    slug?: string;
    school?: string;
    photos?: string[] | null;
  }>;

const publicPath = (p: string) =>
  path.join(ROOT, "public", p.replace(/^\//, ""));

const schools = read("schools.json");
const accommodations = read("accommodations.json");

describe("catalog rows have rendering photos", () => {
  it("every school has a photo whose file exists", () => {
    expect(schools.length).toBeGreaterThan(0);
    for (const s of schools) {
      const photos = (s.photos ?? []).filter((p) => p && p.trim());
      expect(photos.length, `${s.slug} has no photo`).toBeGreaterThan(0);
      for (const p of photos) {
        expect(fs.existsSync(publicPath(p)), `${s.slug}: missing ${p}`).toBe(
          true,
        );
      }
    }
  });

  it("every accommodation has a photo whose file exists", () => {
    expect(accommodations.length).toBeGreaterThan(0);
    for (const a of accommodations) {
      const photos = (a.photos ?? []).filter((p) => p && p.trim());
      expect(
        photos.length,
        `${a.school}/${a.name_en} has no photo`,
      ).toBeGreaterThan(0);
      for (const p of photos) {
        expect(
          fs.existsSync(publicPath(p)),
          `${a.school}/${a.name_en}: missing ${p}`,
        ).toBe(true);
      }
    }
  });
});

describe("HORIZONTE photo ownership", () => {
  const linkMigration = fs.readFileSync(
    path.join(MIGRATIONS, "20261005190000_school_photo_links.sql"),
    "utf8",
  );

  it("photo-link migration never assigns photos (would clobber the hero)", () => {
    expect(linkMigration).not.toMatch(/\bphotos\s*=/);
    expect(linkMigration).not.toContain("horizonte/accommodations/");
    expect(linkMigration).toContain("photo_link =");
  });

  it("the HORIZONTE school photo is the dedicated hero and exists", () => {
    const horizonte = schools.find((s) => s.slug === "horizonte");
    expect(horizonte?.photos).toContain(
      "/lovable-uploads/schools/horizonte/school/hero.jpg",
    );
    expect(
      fs.existsSync(
        publicPath("/lovable-uploads/schools/horizonte/school/hero.jpg"),
      ),
    ).toBe(true);
  });

  it("the repair migration re-asserts the hero only for the clobbered set", () => {
    const repair = fs.readFileSync(
      path.join(MIGRATIONS, "20261005200000_reassert_horizonte_hero_photo.sql"),
      "utf8",
    );
    // Restores the dedicated hero...
    expect(repair).toContain(
      "ARRAY['/lovable-uploads/schools/horizonte/school/hero.jpg']",
    );
    // ...but only when photos are exactly the three accommodation shots the
    // old photo-link migration wrote, so a legitimate admin edit is untouched.
    expect(repair).toMatch(
      /AND photos = ARRAY\[[\s\S]*?horizonte\/accommodations\/building\.jpg[\s\S]*?horizonte\/accommodations\/street\.jpg[\s\S]*?horizonte\/accommodations\/view-roofs\.jpg[\s\S]*?\]::text\[\]/,
    );
  });
});
