import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MobileBottomNav from "../MobileBottomNav";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
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
    children?: React.ReactNode;
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

describe("student mobile primary navigation", () => {
  it("renders DARB as the fifth action and removes More for students", () => {
    render(<MobileBottomNav role="student" />);

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const actions = screen.getAllByRole("link");

    expect(actions).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/student");
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute(
      "href",
      "/student/city-guide",
    );
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "href",
      "/student/messages",
    );
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/student/profile",
    );
    expect(screen.getByRole("link", { name: "DARB" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
    expect(nav).toContainElement(screen.getByRole("link", { name: "DARB" }));
  });
});
