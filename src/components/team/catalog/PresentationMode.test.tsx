import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { PresentationMode } from "./PresentationMode";
import type { SchoolGroup, CatalogAccommodation, CatalogSchool } from "@/lib/catalogDisplay";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: unknown) =>
      typeof fallback === "string" ? fallback : _k,
    i18n: { language: "en" },
  }),
}));

const school = (id: string, name: string): CatalogSchool => ({
  id, name_en: name, name_ar: name, city: "Heidelberg", country: "Germany",
  slug: null, website: null, description_en: null, description_ar: null,
  photos: [], is_active: true, created_at: "", updated_at: "",
});

const accommodation = (id: string, name: string, schoolId: string | null, photos: string[] = []): CatalogAccommodation => ({
  created_at: "", currency: "EUR", deposit: null, description: null,
  description_ar: null, description_en: null, distance_note: null, id,
  is_active: true, meals: null, name_ar: name, name_en: name, photos,
  placement_fee: null, price: 210, price_tiers: [], room_type: "single",
  school_id: schoolId, updated_at: "",
});

const group = (s: CatalogSchool, accs: CatalogAccommodation[]): SchoolGroup => ({
  school: s, accommodations: accs,
});

const twoGroups: SchoolGroup[] = [
  group(school("s1", "Alpha"), [accommodation("a1", "Studio One", "s1", ["/p1.jpg"]), accommodation("a2", "Shared Two", "s1", ["/p2.jpg"])]),
  group(school("s2", "Beta"), [accommodation("a3", "Apartment Three", "s2", ["/p3.jpg"])]),
];

describe("PresentationMode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the first slide on open", () => {
    render(<PresentationMode groups={twoGroups} onExit={vi.fn()} />);
    // Slide counter "1 / 3".
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    // First accommodation name is rendered as a heading.
    expect(screen.getByRole("heading", { name: "Studio One" })).toBeInTheDocument();
  });

  it("advances to the next slide on the Play interval", () => {
    render(<PresentationMode groups={twoGroups} onExit={vi.fn()} />);
    // Click Play to start the slideshow.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const playButton = screen.getByRole("button", { name: "Play" });
    act(() => {
      playButton.click();
    });
    // After 10s (default), it should advance to slide 2.
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shared Two" })).toBeInTheDocument();
  });

  it("pauses the slideshow and stops advancing", () => {
    render(<PresentationMode groups={twoGroups} onExit={vi.fn()} />);
    const playButton = screen.getByRole("button", { name: "Play" });
    act(() => {
      playButton.click();
    });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    // Pause.
    const pauseButton = screen.getByRole("button", { name: "Pause" });
    act(() => {
      pauseButton.click();
    });
    // Advancing time should NOT move the slide.
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("ArrowRight keyboard advances, ArrowLeft goes back, Escape exits", () => {
    const onExit = vi.fn();
    render(<PresentationMode groups={twoGroups} onExit={onExit} />);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    act(() => { fireEvent.keyDown(window, { key: "ArrowRight" }); });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    act(() => { fireEvent.keyDown(window, { key: "ArrowLeft" }); });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    act(() => { fireEvent.keyDown(window, { key: "Escape" }); });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("wraps around at the end of the slide list", () => {
    render(<PresentationMode groups={twoGroups} onExit={vi.fn()} />);
    // Go to the last slide (3).
    act(() => { fireEvent.keyDown(window, { key: "ArrowRight" }); });
    act(() => { fireEvent.keyDown(window, { key: "ArrowRight" }); });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    // One more right wraps to slide 1.
    act(() => { fireEvent.keyDown(window, { key: "ArrowRight" }); });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("renders an empty state when there are no slides", () => {
    render(<PresentationMode groups={[]} onExit={vi.fn()} />);
    expect(screen.getByText("No accommodations to display")).toBeInTheDocument();
  });
});
