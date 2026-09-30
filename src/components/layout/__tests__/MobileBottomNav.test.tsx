import { describe, expect, it } from "vitest";

import { MOBILE_NAV_CONFIG } from "../MobileBottomNav";

describe("student mobile primary navigation", () => {
  it("uses DARB as the fifth destination instead of More", () => {
    expect(MOBILE_NAV_CONFIG.student.map((item) => item.key)).toEqual([
      "nav.home",
      "nav.cityGuide",
      "nav.messages",
      "nav.account",
      "nav.darb",
    ]);
    expect(MOBILE_NAV_CONFIG.student).toHaveLength(5);
    expect(MOBILE_NAV_CONFIG.student[4]).toMatchObject({
      key: "nav.darb",
      href: "/",
    });
  });
});
