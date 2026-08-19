import { describe, it, expect } from "vitest";
import { filterApplyNavItem } from "./partnerNav";

const nav = [
  { key: "nav.overview", href: "/partner" },
  { key: "nav.apply", href: "/partner/apply" },
  { key: "nav.account", href: "/partner/profile" },
];

describe("filterApplyNavItem", () => {
  it("keeps the Apply item for an enabled partner", () => {
    expect(filterApplyNavItem(nav, true, true)).toHaveLength(3);
  });

  it("removes only nav.apply for a disabled partner", () => {
    const out = filterApplyNavItem(nav, true, false);
    expect(out.map((i) => i.key)).toEqual(["nav.overview", "nav.account"]);
  });

  it("is a no-op for non-partner roles regardless of the flag", () => {
    expect(filterApplyNavItem(nav, false, false)).toHaveLength(3);
    expect(filterApplyNavItem(nav, false, true)).toHaveLength(3);
  });

  it("returns the same array reference when nothing is filtered", () => {
    expect(filterApplyNavItem(nav, true, true)).toBe(nav);
  });
});
