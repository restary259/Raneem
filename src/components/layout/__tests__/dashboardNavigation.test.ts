import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  DASHBOARD_NAV_CONFIG,
  filterGoogleBusinessNavItems,
  matchesDashboardNavPath,
  resolveDashboardNavItems,
  type DashboardNavItem,
} from "../dashboardNavigation";

const ROOT = process.cwd();
const LOCALES = ["en", "ar", "he"] as const;

const loadDashboard = (locale: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "public/locales", locale, "dashboard.json"),
      "utf8",
    ),
  ).nav;

const hasKey = (value: unknown, key: string): boolean => {
  let cursor: any = value;
  for (const part of key.split(".")) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) return false;
    cursor = cursor[part];
  }
  return typeof cursor === "string";
};

const walk = (items: DashboardNavItem[], visit: (item: DashboardNavItem) => void) => {
  for (const item of items) {
    visit(item);
    if (item.children?.length) walk(item.children, visit);
  }
};

describe("dashboard navigation configuration", () => {
  it("keeps every mobile role within the five-slot limit", () => {
    for (const [role, config] of Object.entries(DASHBOARD_NAV_CONFIG)) {
      expect(
        config.mobilePrimary.length,
        `${role} mobile primary count`,
      ).toBeLessThanOrEqual(5);
      expect(
        config.mobilePrimary.length,
        `${role} mobile primary minimum`,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it("has every config translation key in English, Arabic, and Hebrew", () => {
    const dashboards = Object.fromEntries(
      LOCALES.map((locale) => [locale, loadDashboard(locale)]),
    );
    const missing: string[] = [];

    for (const [role, config] of Object.entries(DASHBOARD_NAV_CONFIG)) {
      walk(
        [
          ...config.desktop,
          ...config.mobilePrimary,
          ...config.accountItems,
          ...(config.quickActions ?? []),
        ],
        (item) => {
          const keys = [item.key, item.group, item.mobileLabelKey].filter(
            (key): key is string => Boolean(key),
          );

          for (const locale of LOCALES) {
            for (const key of keys) {
              const navKey = key.replace(/^nav\./, "");
              if (!hasKey(dashboards[locale], navKey)) {
                missing.push(`${locale}: ${key} (${role})`);
              }
            }
          }
        },
      );
    }

    expect(missing).toEqual([]);
  });

  it("keeps dashboard home routes exact so Overview does not steal subroutes", () => {
    expect(
      matchesDashboardNavPath("/admin/pipeline", DASHBOARD_NAV_CONFIG.admin.desktop[2]),
    ).toBe(false);
    expect(
      matchesDashboardNavPath("/team/cases/123", DASHBOARD_NAV_CONFIG.team_member.desktop[2]),
    ).toBe(true);
    expect(
      matchesDashboardNavPath("/student/my-data", DASHBOARD_NAV_CONFIG.student.mobilePrimary[3]),
    ).toBe(true);
  });

  it("flags the team Google Business entry for gating", () => {
    const flagged = DASHBOARD_NAV_CONFIG.team_member.desktop.filter(
      (item) => item.googleBusinessNavKey,
    );
    expect(flagged.map((item) => item.key)).toEqual(["nav.googleBusiness"]);
    // The flag lives only on the parent group, so removing it removes every tab.
    expect(flagged[0].children?.map((child) => child.href)).toEqual([
      "/team/google",
      "/team/google/reviews",
      "/team/google/profile",
      "/team/google/posts",
      "/team/google/photos",
      "/team/google/insights",
    ]);
  });

  it("hides the Google Business entry from an unassigned team member only", () => {
    const teamNav = DASHBOARD_NAV_CONFIG.team_member.desktop;

    const hidden = filterGoogleBusinessNavItems("team_member", teamNav, false);
    expect(hidden.some((item) => item.googleBusinessNavKey)).toBe(false);
    expect(hidden).toHaveLength(teamNav.length - 1);

    const shown = filterGoogleBusinessNavItems("team_member", teamNav, true);
    expect(shown).toBe(teamNav);

    // An unresolved read is treated as no access.
    expect(
      filterGoogleBusinessNavItems("team_member", teamNav, null).map((i) => i.key),
    ).toEqual(hidden.map((i) => i.key));

    // Admin keeps the entry regardless of the flag.
    const adminNav = DASHBOARD_NAV_CONFIG.admin.desktop;
    expect(filterGoogleBusinessNavItems("admin", adminNav, false)).toBe(adminNav);
  });

  it("composes the apply and Google gates for the sidebar", () => {
    const teamNav = DASHBOARD_NAV_CONFIG.team_member.desktop;
    const hidden = resolveDashboardNavItems("team_member", teamNav, {
      googleBusinessAccess: false,
    });
    expect(hidden.some((item) => item.googleBusinessNavKey)).toBe(false);
    // Non-team roles are unaffected by the Google flag.
    const partnerNav = DASHBOARD_NAV_CONFIG.social_media_partner.desktop;
    const partnerHiddenApply = resolveDashboardNavItems(
      "social_media_partner",
      partnerNav,
      { applyFormEnabled: false, googleBusinessAccess: false },
    );
    expect(partnerHiddenApply.some((item) => item.key === "nav.apply")).toBe(false);
  });
});
