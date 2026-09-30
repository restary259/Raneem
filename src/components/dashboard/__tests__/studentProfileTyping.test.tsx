import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, f?: string) => f ?? k, i18n: { language: "en" } }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/router-compat", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(), signOut: vi.fn() },
    from: vi.fn(),
  },
}));

import StudentProfile from "@/components/dashboard/StudentProfile";

const profile = {
  id: "u1",
  email: "student@example.com",
  full_name: "Student One",
  phone_number: "",
  city: "",
  country: "",
  gender: "",
  intake_month: "",
  university_name: "",
  notes: "",
  eye_color: "",
  arrival_date: "",
  date_of_birth: "",
  german_address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contacts: [],
} as any;

afterEach(cleanup);

function enterEditMode() {
  render(<StudentProfile profile={profile} userId="u1" onProfileUpdate={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /edit/i }));
}

/**
 * Phone Number is reached by its label, not its placeholder: the Emergency
 * Contact Phone input shares the "+972..." placeholder, so a placeholder query
 * would silently switch targets if the field order changed.
 */
function phoneInput() {
  const label = screen.getByText("Phone Number");
  const field = label.closest("div") as HTMLElement;
  return within(field).getByPlaceholderText("+972...") as HTMLInputElement;
}

describe("StudentProfile personal information card", () => {
  it("keeps the caret in the field and accumulates characters while typing", () => {
    enterEditMode();

    const phone = phoneInput();
    phone.focus();
    expect(document.activeElement).toBe(phone);

    fireEvent.change(phone, { target: { value: "0" } });

    // The reported symptom was that only the first letter landed: the input was
    // replaced on every keystroke, so focus fell back to <body> and the next
    // character went nowhere. Both must survive a state update.
    expect(phone.value).toBe("0");
    expect(document.activeElement).toBe(phone);

    fireEvent.change(phone, { target: { value: "05" } });
    fireEvent.change(phone, { target: { value: "050" } });

    expect(phoneInput().value).toBe("050");
    expect(document.activeElement).toBe(phoneInput());
  });

  it("keeps the same input node across renders instead of remounting it", () => {
    enterEditMode();

    const before = phoneInput();
    fireEvent.change(before, { target: { value: "abc" } });

    expect(phoneInput()).toBe(before);
  });
});
