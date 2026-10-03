import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import KpiRow from "../KpiRow";

/** Contract: a clickable KPI tile is a button; `active` marks the selection. */
describe("KpiRow selection state", () => {
  it("marks the active clickable tile with aria-pressed and an active class", () => {
    render(
      <KpiRow
        items={[
          { key: "pending", label: "Pending", value: 0, onClick: () => {} },
          {
            key: "applied",
            label: "Visa Applied",
            value: 0,
            onClick: () => {},
            active: true,
          },
        ]}
      />,
    );

    const pending = screen.getByRole("button", { name: /Pending/ });
    const applied = screen.getByRole("button", { name: /Visa Applied/ });

    expect(pending).toHaveAttribute("aria-pressed", "false");
    expect(applied).toHaveAttribute("aria-pressed", "true");
    expect(applied.className).toContain("border-primary");
    expect(pending.className).not.toContain("border-primary");
  });

  it("leaves non-clickable tiles as plain divs without aria-pressed", () => {
    render(<KpiRow items={[{ key: "x", label: "Static", value: 1 }]} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Static")).toBeInTheDocument();
  });

  it("invokes onClick when a tile is pressed", () => {
    const onClick = vi.fn();
    render(
      <KpiRow items={[{ key: "p", label: "Pending", value: 3, onClick }]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Pending/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
