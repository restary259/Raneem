import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoogleBusinessAccessGate from "../GoogleBusinessAccessGate";

let access: boolean | null = null;
vi.mock("@/hooks/useGoogleBusinessAccess", () => ({
  useGoogleBusinessAccess: () => access,
}));

vi.mock("@/lib/router-compat", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="redirect">{to}</div>,
}));

vi.mock("@/components/shell/RouteFallbacks", () => ({
  DashboardRouteFallback: () => <div data-testid="loading" />,
}));

describe("GoogleBusinessAccessGate", () => {
  beforeEach(() => {
    access = null;
  });

  it("waits for the server answer instead of bouncing a cold operator", () => {
    access = null;
    render(
      <GoogleBusinessAccessGate>
        <div>secret page</div>
      </GoogleBusinessAccessGate>,
    );
    expect(screen.getByTestId("loading")).toBeInTheDocument();
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
  });

  it("renders the page when the server confirms an assignment", () => {
    access = true;
    render(
      <GoogleBusinessAccessGate>
        <div>secret page</div>
      </GoogleBusinessAccessGate>,
    );
    expect(screen.getByText("secret page")).toBeInTheDocument();
  });

  it("redirects to the team dashboard when unassigned", () => {
    access = false;
    render(
      <GoogleBusinessAccessGate>
        <div>secret page</div>
      </GoogleBusinessAccessGate>,
    );
    expect(screen.getByTestId("redirect")).toHaveTextContent("/team");
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
  });
});
