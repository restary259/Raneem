import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const rpc = vi.fn();
const invoke = vi.fn();
const toast = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/functionError", () => ({ readFunctionError: async (e: any) => e?.message ?? "err" }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_k: string, fb?: string) => fb ?? _k }),
}));

import AppointmentActionMenu from "../AppointmentActionMenu";

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Manage appointment/ }));
}

describe("AppointmentActionMenu", () => {
  beforeEach(() => {
    rpc.mockReset();
    invoke.mockReset();
    toast.mockReset();
  });

  it("confirms the visit and refreshes", async () => {
    rpc.mockResolvedValue({ error: null });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<AppointmentActionMenu appointmentId="a1" onDone={onDone} />);
    await openMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: /Confirm/ }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith("confirm_public_appointment", { p_appointment_id: "a1" });
    expect(toast).toHaveBeenCalledWith({ description: "Appointment confirmed" });
  });

  it("shows an error and does not refresh when confirm fails", async () => {
    rpc.mockResolvedValue({ error: new Error("denied") });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<AppointmentActionMenu appointmentId="a1" onDone={onDone} />);
    await openMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: /Confirm/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: "destructive", description: "denied" }));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Manage appointment/ })).not.toBeDisabled();
  });

  it("reschedules only after a date is picked", async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    const onDone = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<AppointmentActionMenu appointmentId="a2" onDone={onDone} />);
    await openMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: /Reschedule/ }));
    const save = await screen.findByRole("button", { name: /Save/ });
    expect(save).toBeDisabled();
    const input = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    expect(input ?? container).toBeTruthy();
    await user.type(input, "2030-01-15T10:00");
    await user.click(screen.getByRole("button", { name: /Save/ }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [fn, opts] = invoke.mock.calls[0];
    expect(fn).toBe("record-appointment-outcome");
    expect(opts.body.outcome).toBe("rescheduled");
    expect(opts.body.appointment_id).toBe("a2");
    expect(opts.body.new_scheduled_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(toast).toHaveBeenCalledWith({ description: "Appointment rescheduled" });
  });

  it("cancels only after the second confirmation", async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<AppointmentActionMenu appointmentId="a3" onDone={onDone} />);
    await openMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: /Cancel appointment/ }));
    expect(await screen.findByText("Cancel this appointment?")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Cancel appointment/ }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(invoke.mock.calls[0][1].body).toMatchObject({ outcome: "cancelled", new_scheduled_at: null });
    expect(toast).toHaveBeenCalledWith({ description: "Appointment cancelled" });
  });

  it("surfaces server error on cancel without refreshing", async () => {
    invoke.mockResolvedValue({ data: { error: "Not allowed" }, error: null });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<AppointmentActionMenu appointmentId="a4" onDone={onDone} />);
    await openMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: /Cancel appointment/ }));
    await user.click(await screen.findByRole("button", { name: /Cancel appointment/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: "destructive", description: "Not allowed" }));
    expect(onDone).not.toHaveBeenCalled();
  });
});
