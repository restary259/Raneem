import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, f?: string) => f ?? k, i18n: { language: "en" } }),
}));

// TabErrorBoundary reads the real i18n instance; stub it so the fallback copy is
// deterministic and the boundary does not pull the app's i18n boot path.
vi.mock("@/i18n", () => ({
  default: { t: (_k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _k },
}));

import TabHub, { type HubTab } from "../TabHub";
import { MemoryRouter } from "@/lib/router-compat";

/**
 * Contract: a render-time exception inside ONE tab must be contained by that
 * tab's error boundary. Before this guard, TabHub wrapped panels in Suspense
 * only, so a throwing panel bubbled past the hub to the layout boundary and the
 * WHOLE tab group disappeared (the "Visa tab crashes the page" symptom).
 */
function Boom(): React.ReactElement {
  throw new Error("tab render exploded");
}

const tabs: HubTab[] = [
  { value: "pipeline", label: "Pipeline", render: () => <div>Pipeline body</div> },
  { value: "visa", label: "Visa", render: () => <Boom /> },
];

describe("TabHub per-tab error isolation", () => {
  it("contains a throwing tab to its own panel and keeps the tab bar usable", () => {
    // Suppress the boundary's console.error noise for the expected throw.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/admin/pipeline?tab=visa"]}>
        <TabHub tabs={tabs} />
      </MemoryRouter>,
    );

    // The throwing tab is active: its boundary catches the exception...
    expect(
      screen.getByText("This section encountered a problem"),
    ).toBeInTheDocument();

    // ...and the hub itself survives — the tab bar is still mounted.
    expect(screen.getByRole("tab", { name: /Pipeline/ })).toBeInTheDocument();

    // Recovery: switching to a healthy tab renders its body (no reload needed).
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Pipeline/ }));
    expect(screen.getByText("Pipeline body")).toBeInTheDocument();

    spy.mockRestore();
  });
});
