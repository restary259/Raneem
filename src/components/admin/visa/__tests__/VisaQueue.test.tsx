import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, f?: string) => f ?? k }),
}));

import VisaQueue from "../VisaQueue";
import type { VisaQueueRow } from "@/services/VisaService";

const row = (overrides: Partial<VisaQueueRow> = {}): VisaQueueRow =>
  ({
    case_id: "c1",
    student_user_id: "u1",
    actual_arrival: null,
    visa_status: "not_applied",
    visa_applied_at: null,
    ...overrides,
  }) as VisaQueueRow;

/**
 * Contract: section switching is owned by the page KPI row. The queue must not
 * render a second set of section buttons — that duplicate row was the original
 * "Pending 0 / Visa Applied 0" complaint.
 */
describe("VisaQueue section controls", () => {
  it("renders only the empty state, with no duplicate section buttons", () => {
    render(
      <VisaQueue
        rows={[]}
        activeSection="pending"
        onOpen={() => {}}
        onMarkArrived={() => {}}
        markingCaseId={null}
      />,
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(
      screen.getByText("No enrolled students are waiting for their Visa file."),
    ).toBeInTheDocument();
  });

  it("shows the empty message for the selected section", () => {
    render(
      <VisaQueue
        rows={[]}
        activeSection="applied"
        onOpen={() => {}}
        onMarkArrived={() => {}}
        markingCaseId={null}
      />,
    );

    expect(
      screen.getByText("No Visa files have been submitted for administration."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No enrolled students are waiting for their Visa file."),
    ).toBeNull();
  });

  it("buckets rows into the active section only", () => {
    render(
      <VisaQueue
        rows={[
          row({ case_id: "p1" }),
          row({ case_id: "a1", visa_status: "applied" }),
        ]}
        activeSection="applied"
        onOpen={() => {}}
        onMarkArrived={() => {}}
        markingCaseId={null}
      />,
    );

    expect(
      screen.queryByText("No Visa files have been submitted for administration."),
    ).toBeNull();
  });
});
