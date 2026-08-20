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

vi.mock("react-router-dom", () => ({
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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => chainResult({ data: [], error: null, count: 0 }),
  },
}));

import TeamWorkPage from "@/pages/team/TeamWorkPage";

describe("TeamWorkPage — Cash owed to Admin KPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    render(<TeamWorkPage />);

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

    render(<TeamWorkPage />);

    await waitFor(() => {
      expect(screen.getByText("Cash owed to Admin")).toBeInTheDocument();
      expect(screen.getByText("₪0")).toBeInTheDocument();
    });
  });
});
