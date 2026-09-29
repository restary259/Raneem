import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// ── i18n: fallbacks, plus the few keys the page uses WITHOUT a fallback ───
const KEY_TEXT: Record<string, string> = {
  "admin.activity.noActivity": "No activity found",
  "common.loading": "Loading...",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: unknown) =>
      typeof fallback === "string" ? fallback : (KEY_TEXT[_k] ?? _k),
    i18n: { language: "en" },
  }),
}));

// ── Toasts: no-op ─────────────────────────────────────────────────────────
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// ── Realtime: capture the subscribed table, no live channel ───────────────
vi.mock("@/hooks/useRealtimeSubscription", () => ({
  useRealtimeSubscription: vi.fn(),
}));

// ── Supabase: record the table read; rows are swappable per test ──────────
const mockFrom = vi.fn();
let activityData: unknown[] = [];

const chainResult = (result: unknown) => {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
};

const activityRows = [
  {
    id: "act-1",
    actor_id: "u-1",
    actor_name: "Admin One",
    action: "case.status_changed",
    entity_type: "case",
    entity_id: "case-1",
    metadata: {},
    created_at: "2026-09-29T10:00:00Z",
  },
  {
    id: "act-2",
    actor_id: null,
    actor_name: null,
    action: "submission.created",
    entity_type: "submission",
    entity_id: "sub-1",
    metadata: {},
    created_at: "2026-09-29T11:00:00Z",
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return chainResult({ data: activityData, error: null });
    },
  },
}));

import AdminActivityPage from "@/pages/admin/AdminActivityPage";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

/**
 * Behavioural companion to the source-scan guard: it proves the Live Activity
 * Feed actually still READS `activity_log`, renders the returned entries, and
 * SUBSCRIBES to `activity_log` — the behaviour the string checks alone cannot
 * observe (a page could keep the strings and stop fetching).
 */
describe("AdminActivityPage — Live Activity Feed still works", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activityData = activityRows;
  });

  it("reads activity_log and renders the returned entries", async () => {
    render(<AdminActivityPage />);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("activity_log");
    });

    // Rows render with their actor (falling back to "System" when null) and action.
    expect(await screen.findByText("Admin One")).toBeInTheDocument();
    expect(screen.getByText("case.status_changed")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("submission.created")).toBeInTheDocument();

    // The feed's own chrome is present.
    expect(screen.getByText("Live Activity Feed")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search activity..."),
    ).toBeInTheDocument();
  });

  it("subscribes to activity_log realtime updates", async () => {
    render(<AdminActivityPage />);

    await waitFor(() => {
      expect(useRealtimeSubscription).toHaveBeenCalledWith(
        "activity_log",
        expect.any(Function),
        true,
      );
    });
  });

  it("shows the empty state when the log is empty", async () => {
    activityData = [];

    render(<AdminActivityPage />);

    expect(await screen.findByText("No activity found")).toBeInTheDocument();
  });
});
