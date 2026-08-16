import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Contract under test: the "Referred By" row surfaces the right name for every
 * attribution path:
 *  1. Partner/agent self-referral (own link or built-in dashboard apply form)
 *     → partner_id holds the referrer, referred_by is NULL, attribution method
 *       is "link" / "partner_self" → "Referred By" falls back to the partner name.
 *  2. A partner/ambassador recruited by an agent (the agent's network) refers a
 *     student via their link → partner_id holds the recruited partner,
 *     referred_by is NULL, attribution method "link" → "Referred By" shows the
 *     recruited partner's name (NOT the agent). The student still registers in
 *     the agent dashboard (verified separately via get_my_agent_students/RLS).
 *  3. A student refers another student → referred_by holds the referring
 *     student, partner_id is NULL → "Referred By" shows the referring student's
 *     name (the fallback must NOT fire here).
 *
 * The fallback only triggers when referred_by resolves to no name AND the
 * attribution method is a self/link referral, never for student-to-student
 * referrals (where referred_by is populated).
 */

// Use the real en dashboard dictionary so label keys resolve to their actual
// text (the component calls several t("case.overview.*") / t("case.fields.*")
// without inline fallbacks).
import enDashboard from "../../../../public/locales/en/dashboard.json";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any) => {
      const segs = key.split(".");
      let cur: any = enDashboard;
      for (const s of segs) cur = cur?.[s];
      if (typeof cur === "string") return cur;
      return typeof fallback === "string" ? fallback : (fallback?.defaultValue ?? key);
    },
  }),
}));

/** Map of profile id → full_name returned by the resolve_profile_names RPC. */
let namesMap: Record<string, string> = {};
const resolveNames = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: any) => {
      if (fn === "resolve_profile_names") {
        resolveNames(args.p_ids);
        const data = (args.p_ids as string[])
          .filter((id) => namesMap[id])
          .map((id) => ({ id, full_name: namesMap[id] }));
        return Promise.resolve({ data, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  },
}));

vi.mock("@/utils/dateUtils", () => ({
  formatDateMedium: () => "Jan 1, 2026",
}));

import CaseOverviewPanel from "../CaseOverviewPanel";

let caseData: Record<string, any>;

beforeEach(() => {
  namesMap = {};
  resolveNames.mockClear();
});

const openPanel = async () => {
  const utils = render(<CaseOverviewPanel caseData={caseData as any} />);
  // The collapse trigger button shows the overview title ("Overview").
  const trigger = await screen.findByRole("button");
  trigger.click();
  // wait for the "Referred by" row populated after the RPC resolves
  await waitFor(() => expect(screen.getByText("Referred by")).toBeInTheDocument());
  return utils;
};

describe("CaseOverviewPanel — Referred By attribution", () => {
  it("scenario 1a: partner self-referral via built-in apply form shows partner name", async () => {
    namesMap = { "p-1": "Yara Khalil" };
    caseData = {
      partner_id: "p-1",
      referred_by: null,
      source_attribution_method: "partner_self",
      phone_number: "+972500000001",
    };
    await openPanel();
    const refByCell = screen.getByText("Referred by").closest("div");
    expect(refByCell?.textContent).toContain("Yara Khalil");
  });

  it("scenario 1b: partner self-referral via own referral link shows partner name", async () => {
    namesMap = { "p-2": "Liam Cohen" };
    caseData = {
      partner_id: "p-2",
      referred_by: null,
      source_attribution_method: "link",
      phone_number: "+972500000002",
    };
    await openPanel();
    const refByCell = screen.getByText("Referred by").closest("div");
    expect(refByCell?.textContent).toContain("Liam Cohen");
  });

  it("scenario 2: agent's recruited partner refers a student → shows the recruit (not the agent)", async () => {
    namesMap = { "recruit-1": "Maya Saadi" };
    caseData = {
      partner_id: "recruit-1",
      referred_by: null,
      source_attribution_method: "link",
      phone_number: "+972500000003",
    };
    await openPanel();
    const refByCell = screen.getByText("Referred by").closest("div");
    expect(refByCell?.textContent).toContain("Maya Saadi");
    // The "Partner" row no longer exists — only "Referred by" is shown.
    expect(screen.queryByText("Partner")).not.toBeInTheDocument();
  });

  it("scenario 3: student-to-student referral shows the referring student (fallback does not fire)", async () => {
    namesMap = { "student-1": "Noor Haddad" };
    caseData = {
      partner_id: null,
      referred_by: "student-1",
      source_attribution_method: "link",
      phone_number: "+972500000004",
    };
    await openPanel();
    const refByCell = screen.getByText("Referred by").closest("div");
    expect(refByCell?.textContent).toContain("Noor Haddad");
  });

  it("no attribution at all → 'Referred by' shows 'Not set yet'", async () => {
    namesMap = {};
    caseData = {
      partner_id: null,
      referred_by: null,
      source_attribution_method: null,
      phone_number: "+972500000005",
    };
    await openPanel();
    const refByCell = screen.getByText("Referred by").closest("div");
    expect(refByCell?.textContent).toContain("Not set yet");
    expect(screen.queryByText("Partner")).not.toBeInTheDocument();
  });
});
