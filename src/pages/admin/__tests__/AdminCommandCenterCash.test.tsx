import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── i18n: return fallbacks with basic {{var}} interpolation ───────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: unknown, opts?: Record<string, unknown>) => {
      let s =
        typeof fallback === "string"
          ? fallback
          : ((fallback as { defaultValue?: string } | undefined)?.defaultValue ?? _k);
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          s = s.replace(`{{${k}}}`, String(v));
        }
      }
      return s;
    },
    i18n: { language: "en" },
  }),
}));

// ── Router ────────────────────────────────────────────────────────────────
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

// ── Realtime: no-op in tests ──────────────────────────────────────────────
vi.mock("@/hooks/useRealtimeSubscription", () => ({
  useRealtimeSubscription: vi.fn(),
}));

// ── Supabase ──────────────────────────────────────────────────────────────
// A thenable chain: every method returns another chain, awaiting resolves to
// the given result. Covers the many .from().select().is().order()... queries
// the Command Center fires for its KPI tiles and queues.
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

const cashRows = [
  {
    payment_id: "pay-1",
    case_id: "case-1",
    case_reference: "DRB-2601-0007",
    student_name: "Student A",
    team_member_id: "tm-1",
    team_member_name: "Team Member One",
    amount: 3000,
    collected_at: "2026-08-10T10:00:00Z",
  },
  {
    payment_id: "pay-2",
    case_id: "case-2",
    case_reference: "DRB-2601-0009",
    student_name: "Student B",
    team_member_id: "tm-2",
    team_member_name: "Team Member Two",
    amount: 2500,
    collected_at: "2026-08-11T09:00:00Z",
  },
];

const mockRpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => chainResult({ data: [], error: null, count: 0 }),
  },
}));

import AdminCommandCenter from "@/pages/admin/AdminCommandCenter";

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminCommandCenter />
    </QueryClientProvider>,
  );
};

describe("AdminCommandCenter — Cash Collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_admin_cash_collections") {
        return Promise.resolve({ data: cashRows, error: null });
      }
      if (name === "settle_cash_collection") {
        return Promise.resolve({
          data: { case_id: "case-1", settled: true, already_settled: false },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it("shows the Cash Collection card instead of Outstanding balances", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Cash Collection")).toBeInTheDocument();
    });

    // The repurposed section lists who collected what, with the amount.
    expect(await screen.findByText(/Student A/)).toBeInTheDocument();
    expect(screen.getByText(/Collected by Team Member One/)).toBeInTheDocument();
    expect(screen.getByText("₪3,000")).toBeInTheDocument();
    expect(screen.getByText(/Student B/)).toBeInTheDocument();
    // Total across unsettled cash.
    expect(screen.getByText("₪5,500")).toBeInTheDocument();

    // The old outstanding-balances queue is gone, not duplicated.
    expect(screen.queryByText("Outstanding balances")).not.toBeInTheDocument();
  });

  it("settles a cash payment via the RPC and refreshes the list", async () => {
    const user = userEvent.setup();
    renderPage();

    const settleButtons = await screen.findAllByRole("button", { name: /Settle/i });
    await user.click(settleButtons[0]);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("settle_cash_collection", { p_case_id: "case-1" });
    });

    // List refetches after settle (initial load + invalidation).
    await waitFor(() => {
      const collectionCalls = mockRpc.mock.calls.filter(
        ([name]) => name === "get_admin_cash_collections",
      );
      expect(collectionCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows the empty state when every cash payment is settled", async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_admin_cash_collections") {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No unsettled cash")).toBeInTheDocument();
    });
  });
});
