import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplyForm from "./ApplyForm";

// Key-echoing translator keeps assertions readable without duplicating copy.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("@/lib/router-compat", () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/consent", () => ({ recordConsent: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));
vi.mock("@/lib/referral", () => ({
  getReferralCode: () => null,
  captureReferralCode: () => null,
  verifyReferralCode: async () => ({ ok: false }),
  shouldKeepReferralCode: () => false,
}));
vi.mock("./MajorAutocomplete", () => ({
  default: () => <input aria-label="major" />,
}));
vi.mock("./PublicOfficeBooking", () => ({
  default: ({ token }: { token: string }) => (
    <div data-testid="public-booking">{token}</div>
  ),
}));

const TOKEN = "b".repeat(64);

const successResponse = () => ({
  ok: true,
  json: async () => ({ ok: true, case_id: "case-1", booking_token: TOKEN }),
});

/** Walk steps 1-3 with the minimum valid input so the submit button appears. */
async function fillToSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByPlaceholderText("apply.fullNamePlaceholder"),
    "Sara Test",
  );
  await user.type(screen.getByPlaceholderText("050-1234567"), "0501234567");
  await user.type(
    screen.getByPlaceholderText("apply.cityPlaceholder"),
    "Haifa",
  );
  await user.click(screen.getByRole("button", { name: "apply.next" })); // 1 -> 2
  await user.click(screen.getByRole("button", { name: "apply.next" })); // 2 -> 3
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "apply.next" })); // 3 -> 4
}

describe("ApplyForm post-submission flow", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => successResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  it("goes straight to the received screen without a WhatsApp/appointment choice", async () => {
    const user = userEvent.setup();
    render(<ApplyForm />);
    await fillToSubmit(user);
    await user.click(screen.getByTestId("apply-submit"));

    expect(
      await screen.findByText("apply.receivedTitle", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    // No choice screen and no WhatsApp CTA anywhere in the funnel.
    expect(screen.queryByText("apply.nextStepTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("apply.chooseWhatsApp")).not.toBeInTheDocument();
    expect(screen.queryByText("apply.chooseBooking")).not.toBeInTheDocument();
    // The received screen offers the optional early appointment instead.
    expect(
      screen.getByRole("button", { name: "apply.appointmentCta" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /apply\.browsePrograms/ }),
    ).toBeInTheDocument();
  });

  it("opens the existing booking flow only when the appointment CTA is clicked", async () => {
    const user = userEvent.setup();
    render(<ApplyForm />);
    await fillToSubmit(user);
    await user.click(screen.getByTestId("apply-submit"));

    await screen.findByText("apply.receivedTitle", {}, { timeout: 3000 });
    expect(screen.queryByTestId("public-booking")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "apply.appointmentCta" }),
    );
    expect(screen.getByTestId("public-booking")).toHaveTextContent(TOKEN);
    expect(screen.queryByText("apply.receivedTitle")).not.toBeInTheDocument();
  });

  it("keeps the form and shows no success screen when submission fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "boom" }),
    });
    const user = userEvent.setup();
    render(<ApplyForm />);
    await fillToSubmit(user);
    await user.click(screen.getByTestId("apply-submit"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("apply.receivedTitle")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "apply.appointmentCta" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("apply-form")).toBeInTheDocument();
  });

  it("does not create a second case on a double submit", async () => {
    let release: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<ApplyForm />);
    await fillToSubmit(user);

    const submit = screen.getByTestId("apply-submit");
    await user.click(submit);
    await user.click(submit);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release(successResponse());
    await screen.findByText("apply.receivedTitle", {}, { timeout: 3000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ApplyForm embedded (in-dashboard) post-submission", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => successResponse()),
    );
  });

  // Regression: the appointment CTA is public-only. The embedded partner/agent
  // forms must not offer it even if the edge function returns a booking token.
  it("never shows the public appointment CTA, and still shows the received screen", async () => {
    const user = userEvent.setup();
    render(<ApplyForm embedded useSessionAuth />);
    await fillToSubmit(user);
    await user.click(screen.getByTestId("apply-submit"));

    expect(
      await screen.findByText("apply.receivedTitle", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "apply.appointmentCta" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("public-booking")).not.toBeInTheDocument();
  });
});
