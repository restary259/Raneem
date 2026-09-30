import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import EmergencyCallCard, {
  EmergencyNumberButtons,
} from "../EmergencyCallCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: "en" },
  }),
}));

/**
 * Contract under test: the emergency strip dials emergency services directly.
 * Every entry must be an anchor whose href is a `tel:` deep link — never a chat
 * route — so tapping it opens the native call confirmation.
 */
describe("EmergencyCallCard", () => {
  it("renders one tel: link per emergency service", () => {
    render(<EmergencyCallCard />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);

    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^tel:(110|112)$/);
    }
  });

  it("offers the German police and ambulance/fire numbers", () => {
    render(<EmergencyCallCard />);

    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("tel:110");
    expect(hrefs).toContain("tel:112");
  });

  it("never links an emergency entry to the chat", () => {
    render(<EmergencyCallCard />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toContain("/student/messages");
      expect(link.getAttribute("href")).not.toContain("wa.me");
    }
  });

  it("labels each service for screen readers", () => {
    render(<EmergencyCallCard />);

    expect(screen.getByText("Police")).toBeInTheDocument();
    expect(screen.getByText("Ambulance")).toBeInTheDocument();
    expect(screen.getByText("Fire brigade")).toBeInTheDocument();
  });
});

describe("EmergencyNumberButtons (chat-box variant)", () => {
  it("keeps the same tel: numbers and dials, never chats", () => {
    render(<EmergencyNumberButtons />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^tel:(110|112)$/);
    }
    expect(screen.getByLabelText("Police 110")).toBeInTheDocument();
    expect(screen.getByLabelText("Ambulance 112")).toBeInTheDocument();
  });
});
