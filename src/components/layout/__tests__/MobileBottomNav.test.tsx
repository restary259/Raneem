import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import MobileBottomNav from "../MobileBottomNav";
import type { AppRole } from "@/contexts/AuthContext";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "nav.home": "Home",
      "nav.overview": "Overview",
      "nav.pipeline": "Pipeline",
      "nav.messages": "Messages",
      "nav.students": "Students",
      "nav.financials": "Finance",
      "nav.mobile.finance": "Finance",
      "nav.myWork": "My work",
      "nav.cases": "Cases",
      "nav.staffInbox": "Inbox",
      "nav.mobile.inbox": "Inbox",
      "nav.appointments": "Appointments",
      "nav.mobile.appointments": "Appointments",
      "nav.cityGuide": "City Guide",
      "nav.cityGuideMobile": "Map",
      "nav.earnings": "Earnings",
      "nav.mobile.earnings": "Earnings",
      "nav.network": "Network",
      "nav.mobile.network": "Network",
      "nav.apply": "Apply",
      "nav.mobile.apply": "Apply",
      "nav.account": "Account",
      "nav.darb": "DARB",
      "nav.bottomNav": "Main navigation",
    }[key] ?? key),
    i18n: { language: "en" },
  }),
}));

vi.mock("@/hooks/useApplyFormEnabled", () => ({
  useApplyFormEnabled: () => true,
}));

vi.mock("@/lib/router-compat", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children?: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({
    pathname: "/student",
    search: "",
    hash: "",
    state: null,
    key: "/student",
  }),
}));

const EXPECTED: Record<AppRole, string[]> = {
  admin: ["/admin", "/admin/pipeline", "/admin/messages", "/admin/students", "/admin/financials"],
  team_member: ["/team", "/team/cases", "/team/messages", "/team/appointments", "/team/students"],
  social_media_partner: ["/partner", "/partner/messages", "/partner/students", "/partner/earnings", "/partner/apply"],
  ambassador: ["/partner", "/partner/messages", "/partner/students", "/partner/earnings", "/partner/apply"],
  agent: ["/agent", "/agent/network", "/agent/students", "/agent/messages", "/agent/earnings"],
  student: ["/student", "/student/city-guide", "/student/messages", "/student/profile", "/"],
};

describe("unified mobile primary navigation", () => {
  for (const [role, hrefs] of Object.entries(EXPECTED) as [AppRole, string[]][]) {
    it(`${role} has the correct five-or-fewer primary destinations and no More action`, () => {
      render(<MobileBottomNav role={role} />);

      const nav = screen.getByRole("navigation", { name: "Main navigation" });
      const actions = screen.getAllByRole("link");

      expect(nav).toBeInTheDocument();
      expect(actions.map((action) => action.getAttribute("href"))).toEqual(hrefs);
      expect(actions.length).toBeLessThanOrEqual(5);
      expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
    });
  }
});
