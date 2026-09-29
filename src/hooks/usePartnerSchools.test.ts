import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { visiblePartnerSchools } from "./usePartnerSchools";

describe("visiblePartnerSchools", () => {
  it("hides schools whose linked Programs school is paused", () => {
    const rows = [
      { slug: "a", catalog_school_id: "1" },
      { slug: "b", catalog_school_id: "2" },
      { slug: "c", catalog_school_id: null },
    ];
    expect(visiblePartnerSchools(rows, new Set(["2"])).map((r) => r.slug)).toEqual(["a", "c"]);
  });
});
