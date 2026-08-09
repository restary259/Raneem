import { describe, expect, it } from "vitest";
import { isProfileComplete } from "@/components/student/StudentOnboardingGate";

const base = {
  full_name: "Sara Haddad",
  phone_number: "+972501112233",
  date_of_birth: "2002-04-01",
  nationality: "Israeli",
  passport_number: "A1234567",
  passport_expiry: "2030-01-01",
  emergency_contacts: [
    { name: "Amal", relationship: "Mother", phone: "+972501234567" },
    { name: "Rami", relationship: "Father", phone: "+972507654321" },
  ],
};

describe("isProfileComplete", () => {
  it("accepts a fully filled profile", () => {
    expect(isProfileComplete(base)).toBe(true);
  });

  it("requires two usable emergency contacts", () => {
    expect(isProfileComplete({ ...base, emergency_contacts: [base.emergency_contacts[0]] })).toBe(false);
    expect(
      isProfileComplete({
        ...base,
        emergency_contacts: [base.emergency_contacts[0], { name: "X", relationship: "", phone: "" }],
      }),
    ).toBe(false);
  });

  it("rejects missing identity fields", () => {
    expect(isProfileComplete({ ...base, passport_number: "" })).toBe(false);
    expect(isProfileComplete({ ...base, nationality: null })).toBe(false);
    expect(isProfileComplete(null)).toBe(false);
  });

  it("does not require passport expiry", () => {
    expect(isProfileComplete({ ...base, passport_expiry: null })).toBe(true);
  });
});
