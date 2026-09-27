import { describe, expect, it } from "vitest";
import { DASHBOARD_PREFIXES, isDashboardPath, shouldShowFloatingWidgets } from "@/lib/floatingWidgets";

/**
 * The app-download tab and the WhatsApp tab share this decision, so it is the
 * one place that can silently put either widget on a dashboard.
 */

describe("isDashboardPath", () => {
  it("matches each dashboard root and its children", () => {
    for (const prefix of DASHBOARD_PREFIXES) {
      expect(isDashboardPath(prefix), prefix).toBe(true);
      expect(isDashboardPath(`${prefix}/cases/123`), `${prefix} child`).toBe(true);
    }
  });

  it("covers the shell's legacy redirect aliases", () => {
    // These redirect into /team/* and /student/*; the widgets must stay hidden
    // during the redirect so they don't flash over the incoming dashboard.
    expect(isDashboardPath("/team-dashboard")).toBe(true);
    expect(isDashboardPath("/student-dashboard")).toBe(true);
  });

  it("does not match public pages", () => {
    for (const path of ["/", "/about", "/services", "/blog", "/contact", "/resources/cost-calculator"]) {
      expect(isDashboardPath(path), path).toBe(false);
    }
  });

  it("does not match a prefix that merely starts with the same letters", () => {
    expect(isDashboardPath("/teamwork")).toBe(false);
    expect(isDashboardPath("/administrators")).toBe(false);
    expect(isDashboardPath("/studentship")).toBe(false);
  });
});

describe("shouldShowFloatingWidgets", () => {
  it("hides the widgets on every dashboard path", () => {
    for (const prefix of DASHBOARD_PREFIXES) {
      expect(shouldShowFloatingWidgets(prefix), prefix).toBe(false);
      expect(shouldShowFloatingWidgets(`${prefix}/messages`), `${prefix} child`).toBe(false);
    }
  });

  it("hides the widgets on the apply page", () => {
    expect(shouldShowFloatingWidgets("/apply")).toBe(false);
  });

  it("hides the widgets on the legacy dashboard redirects", () => {
    expect(shouldShowFloatingWidgets("/team-dashboard")).toBe(false);
    expect(shouldShowFloatingWidgets("/student-dashboard")).toBe(false);
  });

  it("shows the widgets on public pages", () => {
    for (const path of ["/", "/about", "/services", "/blog/some-post", "/faq"]) {
      expect(shouldShowFloatingWidgets(path), path).toBe(true);
    }
  });
});
