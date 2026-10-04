import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let profileData: Array<{ id: string; full_name: string | null }> | null = [];
let profileError: { message: string } | null = null;
let lastInValues: unknown[] | null = null;

function builder() {
  const result = {
    get data() {
      return profileData;
    },
    error: profileError,
  };
  const chain: Record<string, unknown> = {
    select: () => chain,
    in: (_col: string, vals: unknown[]) => {
      lastInValues = vals;
      return chain;
    },
    then: (resolve: (v: typeof result) => void) =>
      Promise.resolve(result).then(resolve),
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`unexpected from(${table})`);
      return builder();
    },
  },
}));

import resolveProfileNames, {
  resolveProfileNames as named,
} from "./resolveProfileNames";

beforeEach(() => {
  profileData = [];
  profileError = null;
  lastInValues = null;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveProfileNames", () => {
  it("returns an empty map without querying when there are no ids", async () => {
    await expect(resolveProfileNames([])).resolves.toEqual({});
    expect(lastInValues).toBeNull();
  });

  it("deduplicates and filters falsy ids before querying", async () => {
    await resolveProfileNames(["a", "a", "", "b"]);
    expect(lastInValues).toEqual(["a", "b"]);
  });

  it("maps ids to full names, falling back to an empty string", async () => {
    profileData = [
      { id: "a", full_name: "Layla" },
      { id: "b", full_name: null },
    ];
    await expect(resolveProfileNames(["a", "b"])).resolves.toEqual({
      a: "Layla",
      b: "",
    });
  });

  it("skips rows without an id", async () => {
    profileData = [{ id: "", full_name: "ghost" } as never];
    await expect(resolveProfileNames(["x"])).resolves.toEqual({});
  });

  it("returns an empty map (never throws) when the query fails", async () => {
    profileError = { message: "rls denied" };
    await expect(resolveProfileNames(["a"])).resolves.toEqual({});
    expect(console.warn).toHaveBeenCalledWith(
      "[Darb] resolveProfileNames failed:",
      "rls denied",
    );
  });

  it("is also the default export", () => {
    expect(resolveProfileNames).toBe(named);
  });
});
