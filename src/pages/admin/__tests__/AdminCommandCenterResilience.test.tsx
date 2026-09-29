import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Regression guard for the Admin Command Center "data disappears after a case
 * action" bug.
 *
 * The realtime `cases` subscription refetches after every case action. The old
 * `fetchAll()` turned a failed query into `[]`, so a transient background
 * failure was reported to React Query as a SUCCESSFUL read of an empty table.
 * React Query then replaced the last known-good cache with fabricated zeros
 * (Active/Submitted/Enrolled/SLA = 0) and the admin had to relaunch the app.
 *
 * These tests drive the real React Query client against a mocked Supabase
 * boundary, so they exercise the actual cache/refetch behaviour rather than a
 * hand-rolled assertion about the fetch function.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: unknown, opts?: Record<string, unknown>) => {
      let s =
        typeof fallback === "string"
          ? fallback
          : ((fallback as { defaultValue?: string } | undefined)
              ?.defaultValue ?? _k);
      if (opts) {
        for (const [k, v] of Object.entries(opts))
          s = s.replace(`{{${k}}}`, String(v));
      }
      return s;
    },
    i18n: { language: "en" },
  }),
}));

vi.mock("@/lib/router-compat", () => ({ useNavigate: () => vi.fn() }));

// Capture the realtime callback so a test can trigger the refetch the way a
// `cases` table change would — without removing the subscription.
const realtimeCallbacks: Record<string, () => void> = {};
vi.mock("@/hooks/useRealtimeSubscription", () => ({
  useRealtimeSubscription: (table: string, cb: () => void) => {
    realtimeCallbacks[table] = cb;
  },
}));

// ── Supabase boundary ────────────────────────────────────────────────────────
// Each handler returns the PostgREST result the way the real client does:
// success carries rows, failure resolves with an `error` and `data: null`.
type Rows = unknown[];
type Result = { data: Rows | null; error: unknown };

/**
 * Routes a `cases` read by the columns it selects, mirroring how the page
 * distinguishes its three `cases` queries:
 *   `status, last_activity_at, created_at`  -> KPI counts
 *   `id, full_name, case_reference, last_activity_at` -> awaiting review
 *   `id, full_name, case_reference, created_at`       -> unassigned
 */
let casesKpiHandler: () => Result;
let casesReviewHandler: () => Result;
let casesUnassignedHandler: () => Result;
let authHandler: () => Result;
let forgottenHandler: () => Result;

const ok = (rows: Rows) => () => ({ data: rows, error: null });
const fail = () => () => ({
  data: null,
  error: { message: "transient network failure" },
});

const chain = (resolve: () => Result) => {
  const handler: ProxyHandler<object> = {
    get: (_t, prop) => {
      if (prop === "then") return (res: (v: unknown) => void) => res(resolve());
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
};

const mockRpc = vi.fn();

/**
 * The real `supabase.rpc()` returns a PostgrestFilterBuilder, which is thenable
 * AND chainable (`.limit()`). A bare Promise would make `.limit(6)` throw
 * synchronously and fail the whole snapshot for the wrong reason.
 */
const rpcChain = (resolve: () => Result) => {
  const handler: ProxyHandler<object> = {
    get: (_t, prop) => {
      if (prop === "then") return (res: (v: unknown) => void) => res(resolve());
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => {
      if (table === "cases") {
        let select = "";
        const handler: ProxyHandler<object> = {
          get: (_t, prop) => {
            if (prop === "then") {
              const resolve = () => {
                if (select.includes("status")) return casesKpiHandler();
                if (select.includes("last_activity_at"))
                  return casesReviewHandler();
                return casesUnassignedHandler();
              };
              return (res: (v: unknown) => void) => res(resolve());
            }
            if (prop === "select") {
              return (cols: string) => {
                select = cols;
                return new Proxy({}, handler);
              };
            }
            return () => new Proxy({}, handler);
          },
        };
        return new Proxy({}, handler);
      }
      if (table === "auth_failure_log") return chain(() => authHandler());
      return chain(() => ok([])());
    },
  },
}));

import AdminCommandCenter from "@/pages/admin/AdminCommandCenter";

// "Active" is every non-terminal status, so `submitted` is included in it —
// matching `isActiveStatus()` from src/lib/caseStatus.ts.
const KPI = {
  active: 16, // 12 non-submitted active + 4 submitted
  submitted: 4,
  enrolled: 7,
  sla: 2,
};

// `total` counts non-terminal statuses; `sla_breaches` needs a stale
// last_activity_at on a status that has an SLA threshold.
const caseRows = [
  ...Array.from({ length: 12 }, (_, i) => ({
    // Two stale `new` cases breach the 3-day SLA threshold; the rest are fresh.
    status: i < 2 ? "new" : "contacted",
    last_activity_at: i < 2 ? "2020-01-01T00:00:00Z" : new Date().toISOString(),
    created_at: new Date().toISOString(),
  })),
  ...Array.from({ length: KPI.submitted }, () => ({
    status: "submitted",
    last_activity_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  })),
  ...Array.from({ length: KPI.enrolled }, () => ({
    status: "enrollment_paid",
    last_activity_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  })),
];

const forgottenRows = [{ id: "f-1" }];

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
    },
  });
  const utils = render(
    <QueryClientProvider client={client}>
      <AdminCommandCenter />
    </QueryClientProvider>,
  );
  return { ...utils, client };
};

/** The KPI value cell rendered next to a KPI label. */
const kpiValue = (label: string): string => {
  const card = screen.getByText(label).closest("div");
  return card?.parentElement?.querySelector("p")?.textContent ?? "";
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(realtimeCallbacks)) delete realtimeCallbacks[k];
  casesKpiHandler = ok(caseRows);
  casesReviewHandler = ok([]);
  casesUnassignedHandler = ok([]);
  authHandler = ok([]);
  forgottenHandler = ok(forgottenRows);
  mockRpc.mockImplementation((name: string) => {
    if (name === "get_forgotten_cases")
      return rpcChain(() => forgottenHandler());
    if (name === "list_attribution_integrity_issues")
      return rpcChain(() => ok([])());
    if (name === "get_admin_cash_collections")
      return rpcChain(() => ({ data: [], error: null }));
    return rpcChain(() => ({ data: [], error: null }));
  });
});

describe("AdminCommandCenter — failed refetches must not erase real data", () => {
  it("loads the real KPI values on first render", async () => {
    renderPage();

    await waitFor(() => {
      expect(kpiValue("Active Cases")).toBe(String(KPI.active));
    });
    expect(kpiValue("Submitted")).toBe(String(KPI.submitted));
    expect(kpiValue("Enrolled")).toBe(String(KPI.enrolled));
    expect(kpiValue("SLA Breaches")).toBe(String(KPI.sla));
    expect(kpiValue("Forgotten Cases")).toBe("1");
  });

  it("keeps the previous KPI values when the realtime refetch fails", async () => {
    const { client } = renderPage();

    await waitFor(() => {
      expect(kpiValue("Active Cases")).toBe(String(KPI.active));
    });
    expect(kpiValue("Submitted")).toBe(String(KPI.submitted));

    // A case action fires the realtime refetch; the `cases` read now fails.
    casesKpiHandler = fail();
    await client.refetchQueries({ queryKey: ["admin", "command-center"] });

    // The numbers must NOT flash or settle to zero.
    await waitFor(() => {
      expect(kpiValue("Active Cases")).toBe(String(KPI.active));
    });
    expect(kpiValue("Submitted")).toBe(String(KPI.submitted));
    expect(kpiValue("Enrolled")).toBe(String(KPI.enrolled));
    expect(kpiValue("SLA Breaches")).toBe(String(KPI.sla));
    // ...and the failure is surfaced honestly instead of being hidden.
    expect(
      screen.getByText(
        "Could not refresh — showing the last data that loaded successfully.",
      ),
    ).toBeInTheDocument();
  });

  it("recovers the fresh values once the refetch succeeds again", async () => {
    const { client } = renderPage();

    await waitFor(() => {
      expect(kpiValue("Active Cases")).toBe(String(KPI.active));
    });

    casesKpiHandler = fail();
    await client.refetchQueries({ queryKey: ["admin", "command-center"] });
    await waitFor(() => {
      expect(kpiValue("Active Cases")).toBe(String(KPI.active));
    });

    // Retry succeeds with a changed universe.
    casesKpiHandler = ok([
      {
        status: "new",
        last_activity_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ]);
    forgottenHandler = ok([]);
    await client.refetchQueries({ queryKey: ["admin", "command-center"] });

    await waitFor(() => {
      expect(kpiValue("Active Cases")).toBe("1");
    });
    expect(kpiValue("Submitted")).toBe("0");
    expect(kpiValue("Forgotten Cases")).toBe("0");
    expect(
      screen.queryByText(
        "Could not refresh — showing the last data that loaded successfully.",
      ),
    ).not.toBeInTheDocument();
  });

  it("shows an explicit error with retry — never zeros — when the very first load fails", async () => {
    casesKpiHandler = fail();
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load the Command Center"),
      ).toBeInTheDocument();
    });
    // The fabricated-zero KPI wall must not be rendered at all.
    expect(screen.queryByText("Active Cases")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });

  it("recovers from a failed first load via the Retry button", async () => {
    const user = userEvent.setup();
    casesKpiHandler = fail();
    renderPage();

    const retry = await screen.findByRole("button", { name: /Retry/i });
    casesKpiHandler = ok(caseRows);
    await user.click(retry);

    await waitFor(() => {
      expect(kpiValue("Active Cases")).toBe(String(KPI.active));
    });
  });

  it("reuses the last known-good queue rows when a background queue query fails", async () => {
    // First load: the awaiting-review queue has a row.
    casesReviewHandler = ok([
      {
        id: "c-1",
        full_name: "Real Student",
        case_reference: "DRB-1",
        last_activity_at: new Date().toISOString(),
      },
    ]);
    const { client } = renderPage();
    await waitFor(() => {
      expect(screen.getByText("Real Student")).toBeInTheDocument();
    });

    // Background refetch: the KPI read still succeeds (so the snapshot resolves
    // rather than throwing), but the awaiting-review queue read fails. The
    // snapshot reports `null` for that queue, which must fall back to the rows
    // that loaded successfully instead of rendering an empty queue.
    casesReviewHandler = fail();
    await client.refetchQueries({ queryKey: ["admin", "command-center"] });

    await waitFor(() => {
      expect(kpiValue("Active Cases")).toBe(String(KPI.active));
    });
    expect(screen.getByText("Real Student")).toBeInTheDocument();
    expect(
      screen.queryByText("Nothing waiting for review"),
    ).not.toBeInTheDocument();
  });

  it("keeps retained queue rows across a later unrelated re-render", async () => {
    // The failed snapshot is itself cached, so the retained rows must survive
    // re-renders that are NOT the one immediately following the failure. React
    // Query's structural sharing keeps the same reference when data is deeply
    // equal, so the re-render is forced with a real cash-query change.
    casesReviewHandler = ok([
      {
        id: "c-1",
        full_name: "Real Student",
        case_reference: "DRB-1",
        last_activity_at: new Date().toISOString(),
      },
    ]);
    const { client } = renderPage();
    await waitFor(() => {
      expect(screen.getByText("Real Student")).toBeInTheDocument();
    });

    casesReviewHandler = fail();
    await client.refetchQueries({ queryKey: ["admin", "command-center"] });
    await waitFor(() => {
      expect(screen.getByText("Real Student")).toBeInTheDocument();
    });

    // An unrelated query change re-renders the page without touching the main
    // query. The queue must not fall back to empty.
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_forgotten_cases")
        return rpcChain(() => forgottenHandler());
      if (name === "list_attribution_integrity_issues")
        return rpcChain(() => ok([])());
      if (name === "get_admin_cash_collections")
        return rpcChain(() => ({
          data: [
            {
              payment_id: "p-1",
              case_id: "case-1",
              case_reference: "DRB-9",
              student_name: "Cash Student",
              team_member_id: "tm-1",
              team_member_name: "Team Member",
              amount: 250,
              collected_at: new Date().toISOString(),
            },
          ],
          error: null,
        }));
      return rpcChain(() => ({ data: [], error: null }));
    });
    await client.refetchQueries({ queryKey: ["admin", "cash-collections"] });

    // The cash row proves the re-render happened, and the queue survived it.
    await waitFor(() => {
      expect(screen.getByText("Cash Student")).toBeInTheDocument();
    });
    expect(screen.getByText("Real Student")).toBeInTheDocument();
    expect(
      screen.queryByText("Nothing waiting for review"),
    ).not.toBeInTheDocument();
  });

  it("says the retained queue rows are stale instead of presenting them as current", async () => {
    casesReviewHandler = ok([
      {
        id: "c-1",
        full_name: "Real Student",
        case_reference: "DRB-1",
        last_activity_at: new Date().toISOString(),
      },
    ]);
    const { client } = renderPage();
    await waitFor(() => {
      expect(screen.getByText("Real Student")).toBeInTheDocument();
    });
    // Nothing stale before the failure.
    expect(
      screen.queryByText("Could not refresh — showing the last loaded list."),
    ).not.toBeInTheDocument();

    casesReviewHandler = fail();
    await client.refetchQueries({ queryKey: ["admin", "command-center"] });

    // The rows are kept AND labelled as stale — never silently presented as
    // current, and never replaced by an empty state.
    await waitFor(() => {
      expect(
        screen.getByText("Could not refresh — showing the last loaded list."),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Real Student")).toBeInTheDocument();
  });

  it("still renders a genuine empty queue as empty", async () => {
    casesReviewHandler = ok([]);
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("Nothing waiting for review"),
      ).toBeInTheDocument();
    });
    // An empty result is a success — it must not be reported as a load failure.
    expect(screen.queryByText("Unable to load")).not.toBeInTheDocument();
  });
});
