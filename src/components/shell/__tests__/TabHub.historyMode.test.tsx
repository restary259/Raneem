import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "@/lib/router-compat";
import TabHub from "../TabHub";

/**
 * Contract: switching a high-level hub tab (Cases ↔ Students) must be a real
 * history entry so browser Back returns to the previous tab, while lightweight
 * in-page tabs stay replace-only. Before `historyMode`, every tab switch called
 * setSearchParams(..., { replace: true }), so Back skipped past the hub.
 */

const tabs = [
  { value: "cases", label: "Cases", render: () => <div>cases-panel</div> },
  { value: "students", label: "Students", render: () => <div>students-panel</div> },
];

function Probe() {
  const loc = useLocation();
  const index = (loc.state as { __TSR_index?: number } | null)?.__TSR_index;
  return <div data-testid="url">{`${loc.pathname}${loc.search}#${index}`}</div>;
}

function renderHub(historyMode: "push" | "replace", initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Probe />
      <TabHub tabs={tabs} historyMode={historyMode} />
    </MemoryRouter>,
  );
}

describe("TabHub historyMode", () => {
  it("pushes a history entry when historyMode='push'", async () => {
    const user = userEvent.setup();
    renderHub("push", ["/hub"]);

    // First tab is the default, so no param is written yet.
    expect(screen.getByTestId("url").textContent).toBe("/hub#0");
    expect(screen.getByText("cases-panel")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Students" }));

    // A push advances the history index, which is what makes Back return here.
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toBe("/hub?tab=students#1"),
    );
    expect(screen.getByText("students-panel")).toBeInTheDocument();
  });

  it("replaces in place when historyMode='replace' (default)", async () => {
    const user = userEvent.setup();
    renderHub("replace", ["/hub"]);

    await user.click(screen.getByRole("tab", { name: "Students" }));

    // The URL changes but the history index stays put — no extra Back stop.
    await waitFor(() =>
      expect(screen.getByTestId("url").textContent).toBe("/hub?tab=students#0"),
    );
  });
});
