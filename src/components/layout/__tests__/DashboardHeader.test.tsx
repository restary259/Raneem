import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DashboardHeader from "../DashboardHeader";

const navigate = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "nav.student": "Student",
        "nav.accountMenu": "Account menu",
        "nav.language": "Language",
        "nav.languageSelector": "Language selector",
        "nav.mainSite": "Main Site",
        "theme.choose": "Choose theme",
        "header.signOut": "Sign out",
        "nav.home": "Home",
        "nav.quickActions": "Quick actions",
      }[key] ?? key),
    i18n: { language: "en", resolvedLanguage: "en" },
  }),
}));

vi.mock("@/lib/router-compat", () => ({
  Link: ({ to, children, ...props }: { to: string; children?: ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: "/student", search: "", hash: "", state: null, key: "/student" }),
  useNavigate: () => navigate,
}));

vi.mock("@/components/common/LanguageSwitcher", () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="language-switcher" className={className}>English العربية עברית</div>
  ),
}));

vi.mock("@/components/common/ThemePicker", () => ({
  default: () => <button type="button">Theme</button>,
}));

vi.mock("@/components/common/NotificationBell", () => ({
  default: () => <button type="button" aria-label="Notifications">Notifications</button>,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button type="button" aria-label="Toggle Sidebar" className={className}>Menu</button>
  ),
}));

describe("DashboardHeader", () => {
  it("keeps mobile utilities compact and moves language/theme into the account menu", async () => {
    render(
      <DashboardHeader
        role="student"
        user={{ email: "student@example.com", user_metadata: { full_name: "Raneem" } }}
        onSignOut={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(
      screen
        .getAllByTestId("language-switcher")
        .some((el) => el.className.includes("w-full justify-center gap-2")),
    ).toBe(true);
    expect(screen.getByText("Choose theme")).toBeInTheDocument();
    expect(screen.getByText("Main Site")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });
});
