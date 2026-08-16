import { describe, it, expect } from "vitest";
import { groupBySchoolId } from "@/pages/team/TeamCatalogPage";

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
