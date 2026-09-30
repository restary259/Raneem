import { describe, expect, it } from "vitest";
import { MOBILE_NAV_CONFIG } from "@/components/layout/MobileBottomNav";
import { QUICK_ACTIONS } from "@/components/student/StudentDashboardHeader";

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

  it("keeps former More destinations available from Quick Actions", () => {
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
