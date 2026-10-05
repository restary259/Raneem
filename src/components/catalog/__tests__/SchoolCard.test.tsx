import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SchoolCard } from "../SchoolCard";
import type { CatalogSchool } from "@/lib/catalogDisplay";

/**
 * Contract under test: when a school has a `photo_link`, clicking its photo
 * opens that link in a new tab instead of selecting the school (so a 360°
 * walkthrough can be opened straight from the catalog). Without a link the
 * photo stays part of the card and selects the school. A non-http link must
 * never become a live href.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: "en" },
  }),
}));

const school = (overrides: Partial<CatalogSchool> = {}): CatalogSchool => ({
  id: "s1",
  name_ar: "مدرسة",
  name_en: "HORIZONTE German Language School",
  city: "Regensburg",
  country: "Germany",
  slug: "horizonte",
  website: null,
  description_en: "desc",
  description_ar: "وصف",
  photos: ["/lovable-uploads/schools/horizonte/accommodations/building.jpg"],
  photo_link: null,
  is_active: true,
  created_at: "",
  updated_at: "",
  ...overrides,
});

const WALKTHROUGH =
  "https://www.google.com/maps/@49.0185595,12.0934451,3a,90y,269.2h,81.1t/data";

describe("SchoolCard", () => {
  it("opens the photo link in a new tab when set", () => {
    const onSelect = vi.fn();
    render(
      <SchoolCard
        school={school({ photo_link: WALKTHROUGH })}
        programCount={3}
        accommodationCount={8}
        onSelect={onSelect}
      />,
    );

    const link = screen.getByRole("link", { name: /open school walkthrough/i });
    expect(link.getAttribute("href")).toBe(WALKTHROUGH);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("does not select the school when the photo link is clicked", () => {
    const onSelect = vi.fn();
    render(
      <SchoolCard
        school={school({ photo_link: WALKTHROUGH })}
        programCount={3}
        accommodationCount={8}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(
      screen.getByRole("link", { name: /open school walkthrough/i }),
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps the photo as a plain image when no link is set", () => {
    render(
      <SchoolCard
        school={school()}
        programCount={3}
        accommodationCount={8}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /open school walkthrough/i }),
    ).toBeNull();
  });

  it("ignores a non-http photo link", () => {
    render(
      <SchoolCard
        school={school({ photo_link: "javascript:alert(1)" })}
        programCount={0}
        accommodationCount={0}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("link", { name: /open school walkthrough/i }),
    ).toBeNull();
  });
});
