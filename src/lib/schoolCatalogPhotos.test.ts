import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The catalog school cards and accommodation cards are photo-first: a row with
 * an empty `photos` array renders the grey "no photo" placeholder. The HORIZONTE
 * housing rows shipped that way (their photos live in
 * src/data/schoolCatalog/accommodations.json but were committed to the seed
 * before the images were added), so this guard pins the invariant that every
 * school and accommodation row has at least one photo and that the referenced
 * files actually exist under public/. Program/insurance photos stay optional.
 */

const ROOT = process.cwd();
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
