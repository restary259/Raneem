import { describe, expect, it } from "vitest";
import { MOBILE_NAV_CONFIG } from "@/components/layout/MobileBottomNav";
import { QUICK_ACTIONS } from "@/components/student/StudentDashboardHeader";

describe("student mobile navigation", () => {
  it("uses five primary actions and replaces More with DARB", () => {
    expect(MOBILE_NAV_CONFIG.student).toHaveLength(5);
    expect(MOBILE_NAV_CONFIG.student.map((item) => item.key)).toEqual([
      "nav.home",
      "nav.cityGuide",
      "nav.messages",
      "nav.account",
      "nav.darb",
    ]);
    expect(MOBILE_NAV_CONFIG.student.at(-1)).toMatchObject({
      key: "nav.darb",
      href: "/",
    });
  });

  it("keeps every former student More destination available in Quick Actions", () => {
    const routes = new Set(QUICK_ACTIONS.map((item) => item.href));
    expect([
      "/student/checklist",
      "/student/documents",
      "/student/visa",
      "/student/fees",
      "/student/contacts",
      "/student/my-data",
      "/student/tools/bagrut",
      "/student/tools/cv",
      "/student/refer",
    ].every((href) => routes.has(href))).toBe(true);
  });
});
