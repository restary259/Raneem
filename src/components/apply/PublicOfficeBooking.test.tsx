import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PublicOfficeBooking from "./PublicOfficeBooking";

const call = vi.fn();
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => call }));
vi.mock("@/lib/publicBooking.functions", () => ({ managePublicBooking: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }) }));

const slots = ["2026-09-27T07:00:00.000Z", "2026-09-27T07:30:00.000Z", "2026-09-28T07:00:00.000Z"];

describe("PublicOfficeBooking", () => {
  beforeEach(() => {
    call.mockReset();
    call.mockImplementation(async ({ data }: { data: { action: string; slot?: string } }) => {
      if (data.action === "read") return { scheduled_at: null, status: null };
      if (data.action === "availability") return { slots };
      if (data.action === "book") return { scheduled_at: data.slot, status: "pending" };
      if (data.action === "cancel") return { status: "cancelled" };
      return { scheduled_at: data.slot, status: "pending" };
    });
  });

  it("loads a date-first calendar and requests only the chosen time", async () => {
    const user = userEvent.setup();
    render(<PublicOfficeBooking token={"a".repeat(64)} autoOpen />);
    expect(await screen.findByText("apply.availableTimes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10:00" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10:30" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "apply.requestVisit" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "10:30" }));
    await user.click(screen.getByRole("button", { name: "apply.requestVisit" }));
    await waitFor(() => expect(call).toHaveBeenCalledWith({ data: { token: "a".repeat(64), action: "book", slot: slots[1] } }));
    expect(await screen.findByText("apply.visitPending")).toBeInTheDocument();
  });

  it("shows no active controls for an expired private link", async () => {
    call.mockRejectedValue(new Error("expired"));
    render(<PublicOfficeBooking token={"a".repeat(64)} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("apply.invalidVisitLink");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not allow changing the time while a request is in flight", async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    call.mockImplementation(async ({ data }: { data: { action: string } }) => {
      if (data.action === "read") return { scheduled_at: null, status: null };
      if (data.action === "availability") return { slots };
      return new Promise((resolve) => { resolveRequest = resolve; });
    });
    const user = userEvent.setup();
    render(<PublicOfficeBooking token={"a".repeat(64)} autoOpen />);
    const time = await screen.findByRole("button", { name: "10:00" });
    await user.click(time);
    await user.click(screen.getByRole("button", { name: "apply.requestVisit" }));
    expect(time).toBeDisabled();
    expect(screen.getByRole("button", { name: "apply.closeCalendar" })).toBeDisabled();
    resolveRequest({ scheduled_at: slots[0], status: "pending" });
    expect(await screen.findByText("apply.visitPending")).toBeInTheDocument();
  });
});
