import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TeamGoogleReviewsPage from "../TeamGoogleReviewsPage";

/**
 * Regression for the canonical-office tenant-confusion finding: an operator who
 * is a Google operator only for office B must not have the canonical office A
 * Google page silently read/write office B's data. When the workspace office is
 * not in the operator's Google office list the page must refuse, not fall back
 * to the first office.
 */

const OFFICE_A = "office-a";
const OFFICE_B = "office-b";

const workspace = {
  officeId: OFFICE_A,
  slug: "office-a",
  context: {
    office: { id: OFFICE_A, name: "Office A", slug: "office-a" },
  },
};
vi.mock("@/components/office/OfficeWorkspaceLayout", () => ({
  useOfficeWorkspaceContext: () => workspace,
}));
vi.mock("@/lib/officeWorkspace", () => ({
  useOfficeWorkspaceSelection: () => ({
    officeId: OFFICE_A,
    slug: "office-a",
  }),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

vi.mock("@/lib/realtimeRegistry", () => ({ subscribeTables: () => () => {} }));
vi.mock("@/lib/googleBusinessReviews.functions", () => ({
  deleteGoogleReviewReply: vi.fn(),
  publishGoogleReviewReply: vi.fn(),
  syncGoogleReviews: vi.fn(),
}));
vi.mock("@/lib/router-compat", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useParams: () => ({ officeId: "office-a" }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useLocation: () => ({ pathname: "/team/offices/office-a/google/reviews" }),
  useNavigate: () => vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));

const rpcCalls: string[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const resultFor = (fn: string) => {
    if (fn === "list_my_google_offices") {
      return {
        data: [{ office_id: OFFICE_B, office_name: "Office B" }],
        error: null,
      };
    }
    return { data: [], error: null };
  };
  return {
    supabase: {
      rest: {},
      channel: () => ({
        on() {
          return this;
        },
        subscribe() {
          return this;
        },
      }),
      removeChannel: () => Promise.resolve(),
      rpc(fn: string) {
        rpcCalls.push(fn);
        return Promise.resolve(resultFor(fn));
      },
    },
  };
});

describe("TeamGoogleReviewsPage canonical office lock", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
  });

  it("refuses instead of reading another office's reviews", async () => {
    render(<TeamGoogleReviewsPage />);

    expect(
      await screen.findByText("googleReviews.noOfficeTitle"),
    ).toBeInTheDocument();
    // The page never queried office B's reviews / summary.
    expect(rpcCalls).not.toContain("list_office_google_reviews");
    expect(rpcCalls).not.toContain("get_office_google_review_summary");
  });
});
