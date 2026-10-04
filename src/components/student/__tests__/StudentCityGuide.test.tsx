import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudentCityGuide from "../StudentCityGuide";
import en from "../../../../public/locales/en/dashboard.json";

/**
 * Contract under test (from the City Guide review):
 * - a failed profile/school read must surface a retry, never "city not available";
 * - the school-city fallback still resolves a guide when residential_city is empty;
 * - search must match the localized category label (e.g. "supermarket");
 * - the icon button must clear the search + category filters;
 * - curated fixed distances must not be presented as nearby distances.
 *
 * The Supabase client is mocked at the network boundary (it is a remote
 * service); every other module is the real implementation.
 */

const state = vi.hoisted(() => ({
  profile: { residential_city: null as string | null, language_school_id: null as string | null },
  profileError: null as { message: string } | null,
  school: { city: null as string | null },
  schoolError: null as { message: string } | null,
  caseSchoolId: null as string | null,
  schoolsById: {} as Record<string, string>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "case_submissions") {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          not: () => chain,
          order: () => chain,
          limit: async () => ({
            data: state.caseSchoolId ? [{ school_id: state.caseSchoolId }] : [],
            error: null,
          }),
        };
        return chain;
      }
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: async () =>
              table === "profiles"
                ? { data: state.profile, error: state.profileError }
                : {
                    data: id in state.schoolsById ? { city: state.schoolsById[id] } : state.school,
                    error: state.schoolError,
                  },
          }),
        }),
      };
    },
  },
}));

vi.mock("@/hooks/useAuthedUserId", () => ({ useAuthedUserId: () => "user-1" }));

vi.mock("@/lib/router-compat", () => ({ useNavigate: () => vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      let cur: unknown = en;
      for (const part of key.split(".")) {
        if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[part];
        } else {
          return fallback ?? key;
        }
      }
      return typeof cur === "string" ? cur : (fallback ?? key);
    },
    i18n: { language: "en" },
  }),
}));

describe("StudentCityGuide", () => {
  beforeEach(() => {
    state.profile = { residential_city: null, language_school_id: null };
    state.profileError = null;
    state.school = { city: null };
    state.schoolError = null;
  });

  it("shows a retry, not an unsupported-city message, when the profile read fails", async () => {
    state.profileError = { message: "network" };
    render(<StudentCityGuide variant="full" />);

    expect(await screen.findByText(/couldn't load your city/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
    expect(screen.queryByText(/not available yet/i)).toBeNull();
  });

  it("resolves the guide from the language school city when residential_city is empty", async () => {
    state.profile = { residential_city: null, language_school_id: "school-1" };
    state.school = { city: "Heidelberg" };
    render(<StudentCityGuide variant="full" />);

    expect(await screen.findByText("Popular near you")).toBeTruthy();
    expect(screen.getByText("Kaufland Heidelberg-Weststadt")).toBeTruthy();
    expect(screen.queryByText(/not available yet/i)).toBeNull();
  });

  it("matches the localized category label in search", async () => {
    state.profile = { residential_city: "Heidelberg", language_school_id: null };
    render(<StudentCityGuide variant="full" />);
    await screen.findByText("Popular near you");

    await userEvent.type(screen.getByRole("textbox"), "supermarket");

    await waitFor(() => expect(screen.getByText("Kaufland Heidelberg-Weststadt")).toBeTruthy());
    expect(screen.queryByText("VeniceBeach Heidelberg Bahnstadt")).toBeNull();
  });

  it("clears the search and category filters from the icon button", async () => {
    state.profile = { residential_city: "Heidelberg", language_school_id: null };
    render(<StudentCityGuide variant="full" />);
    await screen.findByText("Popular near you");

    const filterButton = screen.getByRole("button", { name: /clear filters/i });
    expect(filterButton).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox"), "zzzz");
    await screen.findByText(/no matching places/i);
    expect(filterButton).toBeEnabled();

    await userEvent.click(filterButton);
    await waitFor(() => expect(screen.getByText("Kaufland Heidelberg-Weststadt")).toBeTruthy());
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("does not present curated fixed distances as nearby distances", async () => {
    state.profile = { residential_city: "Heidelberg", language_school_id: null };
    render(<StudentCityGuide variant="full" />);
    await screen.findByText("Popular near you");

    expect(screen.queryByText("0 km")).toBeNull();
    expect(screen.queryByText("500 m")).toBeNull();
  });

  it("uses the case school's city over the student's home city", async () => {
    state.profile = { residential_city: "Berlin", language_school_id: null };
    state.caseSchoolId = "fu";
    state.schoolsById = { fu: "Heidelberg" };
    render(<StudentCityGuide variant="full" />);

    expect(await screen.findByText("Popular near you")).toBeTruthy();
    expect(screen.queryByText(/not available yet/i)).toBeNull();
  });
});
