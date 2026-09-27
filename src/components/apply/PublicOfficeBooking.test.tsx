import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PublicOfficeBooking from "./PublicOfficeBooking";

const call = vi.fn();
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => call }));
vi.mock("@/lib/publicBooking.functions", () => ({ managePublicBooking: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }) }));

const OFFICE_ID = "11111111-1111-1111-1111-111111111111";
const slots = ["2099-09-27T07:00:00.000Z", "2099-09-27T07:30:00.000Z", "2099-09-28T07:00:00.000Z"];
const offices = [{
  id: OFFICE_ID,
  name_ar: "مكتب درب · طمرة",
  name_en: "DARB Office · Tamra",
  name_he: "משרד דרב · טמרה",
  city: "Tamra",
  address_line_1: "Main Street",
  phone: null,
  map_url: null,
  timezone: "Asia/Jerusalem",
}];

describe("PublicOfficeBooking", () => {
  beforeEach(() => {
    call.mockReset();
    call.mockImplementation(async ({ data }: { data: { action: string; slot?: string } }) => {
      if (data.action === "read") return { scheduled_at: null, status: null, office_id: null };
      if (data.action === "offices") return { offices, current_office_id: null };
      if (data.action === "availability") return { office: offices[0], slots, unavailable: [] };
      if (data.action === "book") return { scheduled_at: data.slot, status: "pending", office_id: OFFICE_ID };
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
    expect(screen.getByRole("button", { name: "Confirm appointment" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "10:30" }));
    await user.click(screen.getByRole("button", { name: "Confirm appointment" }));
    await waitFor(() => expect(call).toHaveBeenCalledWith({
      data: {
        token: "a".repeat(64),
        action: "book",
        slot: slots[1],
        officeId: OFFICE_ID,
        serviceType: "consultation",
      },
    }));
    expect(await screen.findByText("apply.visitRequestedTitle")).toBeInTheDocument();
    expect(screen.queryByText("apply.visitPending")).not.toBeInTheDocument();
  });


  it("keeps unavailable days visible so occupied slots are not hidden", async () => {
    const unavailableSlots = [
      "2099-09-27T07:00:00.000Z",
      "2099-09-27T07:30:00.000Z",
    ];
    call.mockImplementation(async ({ data }: { data: { action: string; slot?: string } }) => {
      if (data.action === "read") return { scheduled_at: null, status: null, office_id: null };
      if (data.action === "offices") return { offices, current_office_id: null };
      if (data.action === "availability") return { office: offices[0], slots: [], unavailable: unavailableSlots };
      return { scheduled_at: data.slot, status: "pending", office_id: OFFICE_ID };
    });

    render(<PublicOfficeBooking token={"a".repeat(64)} autoOpen />);

    const unavailable = await screen.findByRole("button", {
      name: /10:00.*apply\.legendUnavailable/i,
    });
    expect(unavailable).toBeDisabled();
    expect(unavailable).toHaveTextContent("10:00");
  });

  it("shows no active controls for an expired private link", async () => {
    call.mockRejectedValue(new Error("expired"));
    render(<PublicOfficeBooking token={"a".repeat(64)} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("apply.invalidVisitLink");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not allow changing the time while a request is in flight", async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    call.mockImplementation(async ({ data }: { data: { action: string; slot?: string } }) => {
      if (data.action === "read") return { scheduled_at: null, status: null, office_id: null };
      if (data.action === "offices") return { offices, current_office_id: null };
      if (data.action === "availability") return { office: offices[0], slots, unavailable: [] };
      return new Promise((resolve) => { resolveRequest = resolve; });
    });
    const user = userEvent.setup();
    render(<PublicOfficeBooking token={"a".repeat(64)} autoOpen />);
    const time = await screen.findByRole("button", { name: "10:00" });
    await user.click(time);
    await user.click(screen.getByRole("button", { name: "Confirm appointment" }));
    expect(screen.getByRole("button", { name: "10:00" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "apply.closeCalendar" })).toBeDisabled();
    resolveRequest({ scheduled_at: slots[0], status: "pending" });
    expect(await screen.findByText("apply.visitRequestedTitle")).toBeInTheDocument();
    expect(screen.queryByText("apply.visitPending")).not.toBeInTheDocument();
  });
});
