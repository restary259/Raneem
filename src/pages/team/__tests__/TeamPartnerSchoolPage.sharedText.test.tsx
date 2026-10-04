import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TeamPartnerSchoolPage from "../TeamPartnerSchoolPage";

/**
 * The school sheet is one shared component for every partner school. KAPITO's
 * single-room placement rule and registration steps are not seeded in
 * school_notes (they live in its policies), so the page carries fallback copy
 * for them. That copy must render for KAPITO and for nobody else — a leak here
 * is what put "KAPITO" on the F+U page.
 */

vi.mock("react-i18next", () => {
  const t = (key: string, fallback?: unknown) => {
    if (typeof fallback === "string") return fallback;
    return key.split(".").pop() as string;
  };
  return { useTranslation: () => ({ t, i18n: { language: "en" } }) };
});

vi.mock("@/lib/router-compat", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children?: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useParams: () => ({ country: "germany", school: "kapito" }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useLocation: () => ({
    pathname: "/team/partner-schools/germany/kapito",
    search: "",
    hash: "",
    state: null,
    key: "x",
  }),
  useNavigate: () => vi.fn(),
}));

const detail = vi.fn();
vi.mock("@/hooks/usePartnerSchools", () => ({
  usePartnerSchoolDetail: () => detail(),
}));

vi.mock("@/components/team/partnerSchools/SchoolCalculator", () => ({
  default: () => <div data-testid="calculator" />,
}));

const baseCourse = {
  id: "c1",
  code: "standard_intensive",
  name_en: "Intensive Course",
  name_ar: "دورة مكثفة",
  lessons_per_week: 20,
  lesson_minutes: 45,
  schedule_text_en: "Mon–Fri 09:00–12:15",
  schedule_text_ar: "الاثنين–الجمعة",
  max_students: 15,
  min_students: 12,
  is_darb_standard: true,
  start_rule_en: "Every Monday, year round, for students with prior German.",
  start_rule_ar: "كل إثنين",
  included_items: [],
  registration_fee: null,
};

function makeData(slug: string, name: string) {
  return {
    school: {
      id: "s1",
      slug,
      name,
      city: "Test City",
      country_id: "co1",
      catalog_school_id: null,
      website_url: null,
      last_verified_at: null,
      featured_weeks: null,
    },
    country: null,
    version: null,
    courses: [baseCourse],
    courseTiers: [],
    levels: [],
    accommodations: [],
    accommodationTiers: [],
    startDates: [],
    policies: [],
    notes: [],
    sources: [],
  };
}

function renderWith(slug: string, name: string) {
  detail.mockReturnValue({
    data: makeData(slug, name),
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  return render(<TeamPartnerSchoolPage />);
}

async function openTab(label: string) {
  const tab = screen.getByRole("tab", { name: label });
  await userEvent.click(tab);
  return tab;
}

describe("TeamPartnerSchoolPage — school-specific fallback text", () => {
  beforeEach(() => detail.mockReset());

  it("shows the KAPITO single-room rule on KAPITO's own page", async () => {
    renderWith("kapito", "KAPITO Sprachschule");
    await openTab("accommodation");
    expect(screen.getByText(/KAPITO single rooms may be/)).toBeInTheDocument();
  });

  it("never shows the KAPITO single-room rule on another school's page", async () => {
    renderWith("fu-academy", "F+U Academy of Languages");
    await openTab("accommodation");
    expect(screen.queryByText(/KAPITO/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Not recorded/).length).toBeGreaterThan(0);
  });

  it("shows the KAPITO registration steps on KAPITO's own page", async () => {
    renderWith("kapito", "KAPITO Sprachschule");
    await openTab("application");
    expect(
      screen.getByText(/KAPITO reserves the course place/),
    ).toBeInTheDocument();
  });

  it("never shows the KAPITO registration steps on another school's page", async () => {
    renderWith("fu-academy", "F+U Academy of Languages");
    await openTab("application");
    expect(screen.queryByText(/KAPITO/)).not.toBeInTheDocument();
  });

  it("uses the neutral badge on every school", async () => {
    renderWith("kapito", "KAPITO Sprachschule");
    await openTab("application");
    expect(
      screen.getAllByText("Official school procedure").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(/Official KAPITO procedure/),
    ).not.toBeInTheDocument();
  });

  it("puts the short facts on one row and the start rule on its own full-width line", () => {
    renderWith("fu-academy", "F+U Academy of Languages");
    const label = screen.getByText("Course start rule");
    // label -> Fact root -> col-span-full wrapper
    const wrapper = label.parentElement!.parentElement!;
    expect(wrapper.className).toContain("col-span-full");
    const factsGrid = wrapper.parentElement!;
    expect(factsGrid.className).toContain("sm:grid-cols-3");
  });
});
