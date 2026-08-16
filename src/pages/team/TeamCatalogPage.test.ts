import { describe, it, expect } from "vitest";
import { groupBySchoolId, resolvePhotoSources } from "@/pages/team/TeamCatalogPage";

interface Item {
  id: string;
  school_id: string | null;
}

describe("groupBySchoolId", () => {
  it("groups items by school_id", () => {
    const items: Item[] = [
      { id: "1", school_id: "school-a" },
      { id: "2", school_id: "school-b" },
      { id: "3", school_id: "school-a" },
    ];
    const result = groupBySchoolId(items);
    expect(Object.keys(result).sort()).toEqual(["school-a", "school-b"]);
    expect(result["school-a"].map((i) => i.id)).toEqual(["1", "3"]);
    expect(result["school-b"].map((i) => i.id)).toEqual(["2"]);
  });

  it("skips items with null school_id", () => {
    const items: Item[] = [
      { id: "1", school_id: null },
      { id: "2", school_id: "school-a" },
    ];
    const result = groupBySchoolId(items);
    expect(Object.keys(result)).toEqual(["school-a"]);
  });

  it("returns empty object for empty input", () => {
    expect(groupBySchoolId([])).toEqual({});
  });

  it("returns empty object when all items have null school_id", () => {
    const items: Item[] = [
      { id: "1", school_id: null },
      { id: "2", school_id: null },
    ];
    expect(groupBySchoolId(items)).toEqual({});
  });

  it("handles a single school with multiple items", () => {
    const items: Item[] = [
      { id: "1", school_id: "school-a" },
      { id: "2", school_id: "school-a" },
      { id: "3", school_id: "school-a" },
    ];
    const result = groupBySchoolId(items);
    expect(Object.keys(result)).toEqual(["school-a"]);
    expect(result["school-a"]).toHaveLength(3);
  });
});

describe("resolvePhotoSources", () => {
  const bucketRows = [
    { id: "b1", storage_path: "path/b1.jpg", display_order: 0 },
    { id: "b2", storage_path: "path/b2.jpg", display_order: 1 },
  ];
  const externalUrls = [
    "https://example.com/ext1.jpg",
    "https://example.com/ext2.jpg",
  ];

  it("uses bucket rows when available (signed URL attached later)", () => {
    const result = resolvePhotoSources(bucketRows, externalUrls);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("b1");
    expect(result[0].url).toBeUndefined();
  });

  it("falls back to external URLs when no bucket rows", () => {
    const result = resolvePhotoSources([], externalUrls);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("ext-0");
    expect(result[0].url).toBe("https://example.com/ext1.jpg");
    expect(result[0].storage_path).toBe("https://example.com/ext1.jpg");
    expect(result[1].id).toBe("ext-1");
  });

  it("returns empty array when neither source available", () => {
    expect(resolvePhotoSources([], [])).toEqual([]);
    expect(resolvePhotoSources([], null)).toEqual([]);
    expect(resolvePhotoSources([], undefined)).toEqual([]);
  });

  it("returns bucket rows even when external URLs are null", () => {
    const result = resolvePhotoSources(bucketRows, null);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("b1");
  });

  it("returns empty array when both bucket and external are empty", () => {
    expect(resolvePhotoSources([], [])).toEqual([]);
  });
});
