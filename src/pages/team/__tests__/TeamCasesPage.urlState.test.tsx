import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "@/lib/router-compat";

/**
 * Contract: the case list's filter, search and page live in the URL, so opening
 * a case and pressing Back restores the exact same list state. Before this they
 * were local useState and Back landed on the default "all"/page-1/empty view.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) =>
      typeof fallback === "string" ? fallback : _key,
    i18n: { language: "en" },
  }),
}));

const USER = vi.hoisted(() => ({ id: "u1" }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: USER, role: "team_member" }),
}));

// A stable toast: a fresh function each render would change fetchCases identity
// every render and loop the fetch effect forever.
vi.mock("@/hooks/use-toast", () => {
  const toast = vi.fn();
  return { useToast: () => ({ toast }) };
});

const CASES = vi.hoisted(() =>
  Array.from({ length: 60 }, (_, i) => {
    const n = i + 1;
    return {
      id: `case-${n}`,
      full_name: `Case ${String(n).padStart(2, "0")}`,
      phone_number: `05000000${String(n).padStart(2, "0")}`,
      status: n === 12 ? "contacted" : "new",
      source: "manual",
      assigned_to: null,
      last_activity_at: "2024-01-01T00:00:00Z",
      created_at: "2024-01-01T00:00:00Z",
    };
  }),
);

vi.mock("@/integrations/supabase/client", () => {
  const chain = (rows: unknown[]) => {
    const result = Promise.resolve({ data: rows, error: null });
    const api: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "limit"])
      api[method] = () => api;
    api.then = (...args: unknown[]) =>
      (result.then as (...a: unknown[]) => unknown)(...args);
    return api;
  };
  return {
    supabase: {
      from: () => chain(CASES),
      rpc: () => Promise.resolve({ data: null, error: null }),
      auth: {
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
    },
  };
});

import TeamCasesPage from "../TeamCasesPage";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="url">{loc.pathname + loc.search}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <LocationProbe />
      <TeamCasesPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  document.documentElement.dir = "ltr";
});

describe("TeamCasesPage — URL-synced list state", () => {
  it("opens on the page named in the URL and keeps paging in the URL", async () => {
    renderAt("/team/cases?page=2");

    // Page 2 of 25 shows rows 26–50.
    await waitFor(() =>
      expect(screen.getByText("Case 26")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Case 01")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toBe("/team/cases?page=3"),
    );
    expect(await screen.findByText("Case 51")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toBe("/team/cases?page=2"),
    );
  });

  it("seeds the status filter and search from the URL", async () => {
    renderAt("/team/cases?status=contacted&q=Case%2012");

    // Only the single "contacted" case matching the query survives the filter.
    await waitFor(() =>
      expect(screen.getByText("Case 12")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Case 01")).not.toBeInTheDocument();
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "Case 12",
    );

    // Changing the filter rewrites the URL and drops the stale page param.
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toBe(
        "/team/cases?status=new&q=Case+12",
      ),
    );
  });
});
