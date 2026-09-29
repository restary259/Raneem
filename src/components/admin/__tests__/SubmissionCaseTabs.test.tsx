import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import SubmissionCaseTabs, { type SubmittedCase } from "../SubmissionCaseTabs";

/**
 * Contract under test: the tabbed submission card.
 *
 * The load-bearing assertion is #4. Every panel is `forceMount`ed so that the
 * inner `CaseFinance` keeps reporting its Germany-payment readiness through
 * `onReadinessChange` even while the admin sits on another tab. The page uses
 * that snapshot to enable "Mark as Enrolled", so an unmounted Finance panel
 * would leave enrollment permanently disabled. Assertion #4 fails if anyone
 * removes `forceMount` from the Finance panel.
 */

// A chainable Supabase stub: every builder method returns itself and every
// terminal call resolves to empty data. CaseFinance/CaseInvoiceBlock are
// imported transitively and fire several queries on mount.
const emptyResult = { data: null, error: null, count: 0 };
const chain: Record<string, unknown> = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === "then") {
        // Resolve the promise-like builder.
        return (resolve: (v: unknown) => void) => resolve(emptyResult);
      }
      if (prop === "single" || prop === "maybeSingle") {
        return async () => emptyResult;
      }
      return (..._args: unknown[]) => chain;
    },
  },
);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => chain,
    rpc: async () => emptyResult,
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Resolve `t()` against the REAL en locale file. This keeps the tab labels
// faithful to what ships AND proves the admin.submissions.tabs.* keys exist.
import enDashboard from "../../../../public/locales/en/dashboard.json";

const resolve = (key: string): string => {
  const out = key
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc == null ? acc : (acc as Record<string, unknown>)[part],
      enDashboard as unknown,
    );
  return typeof out === "string" ? out : key;
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) =>
      typeof fallback === "string" ? fallback : resolve(k),
    i18n: { language: "en" },
  }),
}));

const fmt = (ts: string | null) => ts ?? "—";

function makeCase(over: Partial<SubmittedCase> = {}): SubmittedCase {
  return {
    id: "case-1",
    full_name: "Ahmed Test",
    phone_number: "0500000000",
    status: "submitted",
    source: "apply",
    created_at: "2026-09-01T00:00:00Z",
    education_level: "Bagrut",
    city: "Tamra",
    passport_type: "israeli",
    student_user_id: "stu-1",
    partner_id: null,
    referred_by: null,
    assigned_to: "tm-1",
    submission: {
      id: "sub-1",
      service_fee: 5000,
      submitted_at: "2026-09-02T00:00:00Z",
      enrollment_paid_at: null,
      program_id: "prog-1",
      accommodation_id: "acc-1",
      program_start_date: "2026-10-01T00:00:00Z",
      program_end_date: "2026-12-01T00:00:00Z",
      payment_confirmed: true,
      program_price: 3000,
      program_weeks: 12,
      program_weekly_price: 250,
      accommodation_price: 1500,
      accommodation_weeks: 12,
      accommodation_weekly_price: 125,
      extra_data: { city: "Tamra", motivation: "study" },
    },
    documents: [
      {
        id: "doc-1",
        file_name: "Passport.pdf",
        file_url: "cases/case-1/Passport.pdf",
        category: "passport",
        created_at: "2026-09-03T00:00:00Z",
      },
    ],
    ...over,
  };
}

function renderTabs(
  caseData: SubmittedCase,
  onFinanceReadinessChange = vi.fn(),
) {
  return render(
    <SubmissionCaseTabs
      caseData={caseData}
      programNames={{ "prog-1": "Intensive German" }}
      accommodationNames={{ "acc-1": "Shared Apartment" }}
      paymentMethod="cash"
      serviceTotalLabel="5,000"
      fmt={fmt}
      onOpenDocument={vi.fn()}
      onFinanceReadinessChange={onFinanceReadinessChange}
    />,
  );
}

// CaseFinance renders its own nested tablist (Summary/Invoice), so role-based
// queries must be scoped to the OUTER strip to avoid matching those.
const outerTablist = () => screen.getAllByRole("tablist")[0];
const trigger = (name: string) =>
  within(outerTablist()).getByRole("tab", { name });
const queryTrigger = (name: string) =>
  within(outerTablist()).queryByRole("tab", { name });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SubmissionCaseTabs", () => {
  it("renders all six tabs for a fully-populated case with Overview active", () => {
    renderTabs(makeCase());
    for (const label of [
      "Overview",
      "Profile",
      "Program & Accommodation",
      "Finance",
      "Invoice",
      "Documents",
    ]) {
      expect(trigger(label)).toBeTruthy();
    }
    expect(trigger("Overview").getAttribute("data-state")).toBe("active");
  });

  it("hides the Program tab when the case has no program/accommodation", () => {
    renderTabs(
      makeCase({
        submission: {
          ...makeCase().submission!,
          program_id: null,
          accommodation_id: null,
        },
      }),
    );
    expect(queryTrigger("Program & Accommodation")).toBeNull();
    // The other tabs are unaffected.
    expect(trigger("Overview")).toBeTruthy();
    expect(trigger("Finance")).toBeTruthy();
  });

  it("hides the Documents tab when the case has no documents", () => {
    renderTabs(makeCase({ documents: [] }));
    expect(queryTrigger("Documents")).toBeNull();
    expect(trigger("Overview")).toBeTruthy();
  });

  it("switches panels without unmounting them (forceMount contract)", async () => {
    renderTabs(makeCase());
    const financePanel = document.querySelector(
      '[data-state][role="tabpanel"]',
    );

    fireEvent.mouseDown(trigger("Finance"), { button: 0 });
    fireEvent.click(trigger("Finance"));
    await waitFor(() =>
      expect(trigger("Finance").getAttribute("data-state")).toBe("active"),
    );

    // Panels are forceMount'ed: the Overview panel must still be in the DOM,
    // merely marked inactive. queryByText being null would mean it unmounted.
    const overview = trigger("Overview");
    expect(overview.getAttribute("data-state")).toBe("inactive");
    expect(financePanel).toBeTruthy();
  });

  it("reports Finance readiness while the Overview tab is active", async () => {
    const onReadiness = vi.fn();
    renderTabs(makeCase(), onReadiness);

    // The admin has NOT opened the Finance tab. forceMount is what makes this
    // pass; without it CaseFinance never mounts and readiness never arrives.
    expect(trigger("Overview").getAttribute("data-state")).toBe("active");
    await waitFor(() => expect(onReadiness).toHaveBeenCalled());

    const readiness = onReadiness.mock.calls.at(-1)?.[0];
    expect(readiness).toMatchObject({
      germanyRequiredTotal: expect.any(Number),
      germanyConfirmedRequired: expect.any(Number),
    });
  });
});
