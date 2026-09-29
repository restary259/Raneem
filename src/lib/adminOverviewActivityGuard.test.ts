import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");
const COMMAND_CENTER = path.resolve(
  SRC_ROOT,
  "pages",
  "admin",
  "AdminCommandCenter.tsx",
);
const ACTIVITY_PAGE = path.resolve(
  SRC_ROOT,
  "pages",
  "admin",
  "AdminActivityPage.tsx",
);
const ACTIVITY_ROUTE = path.resolve(SRC_ROOT, "routes", "admin.activity.tsx");
const LAYOUT = path.resolve(
  SRC_ROOT,
  "components",
  "layout",
  "DashboardLayout.tsx",
);
const MOBILE_NAV = path.resolve(
  SRC_ROOT,
  "components",
  "layout",
  "MobileBottomNav.tsx",
);

/**
 * The Admin Overview (Command Center) used to render its own "Recent Activity"
 * card, fed by a separate `activity_log` query and a `activity_log` realtime
 * subscription. That card was removed from the Overview only — the Live
 * Activity Feed stays available as its own `/admin/activity` destination
 * (linked from the sidebar and the mobile "More" sheet).
 *
 * These assertions lock in both halves of the Definition of Done:
 *   - Overview: no Recent Activity card, no activity_log read, no realtime
 *     subscription, and no leftover placeholder/loading state for it.
 *   - Activity Feed: still routed, still in the nav, and still reads and
 *     subscribes to `activity_log` exactly as before.
 */
describe("Admin Overview has no Recent Activity, the Activity Feed keeps it", () => {
  const commandCenter = fs.readFileSync(COMMAND_CENTER, "utf8");
  const activityPage = fs.readFileSync(ACTIVITY_PAGE, "utf8");

  it("Admin Overview renders no Recent Activity card", () => {
    expect(commandCenter).not.toMatch(/Recent Activity/i);
    expect(commandCenter).not.toMatch(/recentActivity/);
    expect(commandCenter).not.toMatch(/commandCenter\.noActivity/);
    expect(commandCenter).not.toMatch(/commandCenter\.activityLoadError/);
    // The lucide `Activity` icon was imported solely for that card.
    expect(commandCenter).not.toMatch(/\bActivity\b\s*[,}]/);
  });

  it("Admin Overview no longer reads or subscribes to activity_log", () => {
    expect(commandCenter).not.toContain("activity_log");
    expect(commandCenter).not.toMatch(
      /useRealtimeSubscription\(\s*['"]activity_log['"]/,
    );
  });

  it("Admin Overview keeps its remaining queries and subscriptions", () => {
    // Removing the card must not have taken the rest of the Overview with it.
    expect(commandCenter).toContain("useRealtimeSubscription('cases'");
    expect(commandCenter).toContain("useRealtimeSubscription('case_payments'");
    expect(commandCenter).toContain("admin.commandCenter.cashCollection");
    expect(commandCenter).toContain("admin.commandCenter.queueReview");
  });

  it("the Live Activity Feed still reads and subscribes to activity_log", () => {
    expect(activityPage).toContain(".from('activity_log')");
    expect(activityPage).toMatch(
      /useRealtimeSubscription\(\s*['"]activity_log['"]/,
    );
  });

  it("the Live Activity Feed is still routed and reachable from the nav", () => {
    expect(fs.readFileSync(ACTIVITY_ROUTE, "utf8")).toContain(
      '"/admin/activity"',
    );
    expect(fs.readFileSync(LAYOUT, "utf8")).toContain('"/admin/activity"');
    expect(fs.readFileSync(MOBILE_NAV, "utf8")).toContain("'/admin/activity'");
  });
});
