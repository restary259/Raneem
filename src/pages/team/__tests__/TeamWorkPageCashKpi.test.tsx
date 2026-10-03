import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// ── i18n: return fallback strings ─────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: unknown) =>
      typeof fallback === "string"
        ? fallback
        : ((fallback as { defaultValue?: string } | undefined)?.defaultValue ?? _k),
    i18n: { language: "en" },
  }),
}));

vi.mock("@/lib/router-compat", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "tm-1" } }),
}));

// ── Supabase: chainable table queries + controlled RPC ────────────────────
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

const mockRpc = vi.fn();
const mockFrom = vi.fn((..._args: unknown[]) =>
  chainResult({ data: [], error: null, count: 0 }),
);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// AppointmentActionMenu reaches the router/toast/edge functions; stub the
// surface so the page test stays focused on rendering the request rows.
vi.mock("@/components/team/AppointmentActionMenu", () => ({
  default: () => <div data-testid="appointment-action-menu" />,
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TeamWorkPage from "@/pages/team/TeamWorkPage";

// The page reads through the shared query cache now, so each test gets its own
// client (retries off) to keep runs isolated and fast.
const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <TeamWorkPage />
    </QueryClientProvider>,
  );

describe("TeamWorkPage — Cash owed to Admin KPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() =>
      chainResult({ data: [], error: null, count: 0 }),
    );
  });

  it("sums only unsettled cash payments", async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_my_cash_debts") {
        return Promise.resolve({
          data: [
            { payment_id: "p1", case_id: "c1", case_reference: "R1", student_name: "A", amount_owed_to_admin: 1500, debt_status: "pending", collected_at: null, settled_at: null },
            { payment_id: "p2", case_id: "c2", case_reference: "R2", student_name: "B", amount_owed_to_admin: 1500, debt_status: "pending", collected_at: null, settled_at: null },
            // Settled cash must NOT count toward the KPI.
            { payment_id: "p3", case_id: "c3", case_reference: "R3", student_name: "C", amount_owed_to_admin: 2000, debt_status: "settled", collected_at: null, settled_at: "2026-08-01T00:00:00Z" },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Cash owed to Admin")).toBeInTheDocument();
      expect(screen.getByText("₪3,000")).toBeInTheDocument();
    });
  });

  it("shows ₪0 when all cash has been settled", async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === "get_my_cash_debts") {
        return Promise.resolve({
          data: [
            { payment_id: "p3", case_id: "c3", case_reference: "R3", student_name: "C", amount_owed_to_admin: 2000, debt_status: "settled", collected_at: null, settled_at: "2026-08-01T00:00:00Z" },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Cash owed to Admin")).toBeInTheDocument();
      expect(screen.getByText("₪0")).toBeInTheDocument();
    });
  });
});

describe("TeamWorkPage — public booking requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders apply-form booking requests above Today's schedule", async () => {
    const request = {
      id: "req-1",
      case_id: "case-9",
      scheduled_at: "2030-05-05T09:00:00.000Z",
      duration_minutes: 60,
      case: { full_name: "Raneem Student" },
    };
    mockFrom.mockImplementation((...args: unknown[]) => {
      const table = args[0] as string;
      return table === "appointments"
        ? chainResult({ data: [request], error: null, count: 1 })
        : chainResult({ data: [], error: null, count: 0 });
    });
    mockRpc.mockResolvedValue({ data: [], error: null });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("New booking requests")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Raneem Student").length).toBeGreaterThan(0);
    expect(
      screen.getAllByTestId("appointment-action-menu").length,
    ).toBeGreaterThan(0);
  });

  it("hides the requests card when there is nothing pending", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Today's schedule")).toBeInTheDocument();
    });
    expect(screen.queryByText("New booking requests")).not.toBeInTheDocument();
  });
});
