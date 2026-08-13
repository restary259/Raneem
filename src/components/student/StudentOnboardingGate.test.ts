import { describe, expect, it } from "vitest";
import { isProfileComplete } from "@/components/student/StudentOnboardingGate";

const base = {
  full_name: "Sara Haddad",
  phone_number: "+972501112233",
  date_of_birth: "2002-04-01",
  gender: "female",
  nationality: "Israeli",
  city: "Nazareth",
  country: "Israel",
  street: "Olive Street",
  house_number: "12",
  residential_city: "Nazareth",
  university_name: "Goethe-Institut",
  intake_month: "October 2026",
  arrival_date: "2026-09-20",
  passport_expiry: "2030-01-01",
  eye_color: "brown",
  has_changed_legal_name: false,
  has_criminal_record: false,
  has_dual_citizenship: false,
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

  it("accepts two contacts with names + phones but relationship empty (regression)", () => {
    expect(
      isProfileComplete({
        ...base,
        emergency_contacts: [
          { name: "Amal", relationship: "", phone: "+972501234567" },
          { name: "Rami", relationship: "", phone: "+972507654321" },
        ],
      }),
    ).toBe(true);
  });

  it("rejects two contacts with phones but empty names (regression)", () => {
    expect(
      isProfileComplete({
        ...base,
        emergency_contacts: [
          { name: "", relationship: "Mother", phone: "+972501234567" },
          { name: "", relationship: "Father", phone: "+972507654321" },
        ],
      }),
    ).toBe(false);
  });

  it("accepts a legitimate single-character name (relaxed filled)", () => {
    expect(
      isProfileComplete({
        ...base,
        emergency_contacts: [
          { name: "A", relationship: "Mother", phone: "+972501234567" },
          { name: "B", relationship: "Father", phone: "+972507654321" },
        ],
      }),
    ).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(isProfileComplete({ ...base, nationality: "" })).toBe(false);
    expect(isProfileComplete({ ...base, gender: null })).toBe(false);
    expect(isProfileComplete({ ...base, university_name: null })).toBe(false);
    expect(isProfileComplete({ ...base, eye_color: null })).toBe(false);
    expect(isProfileComplete(null)).toBe(false);
  });

  it("does not require passport number or the optional legal-name fields", () => {
    // passport_number is no longer collected by the wizard.
    expect(isProfileComplete({ ...base, has_changed_legal_name: true, previous_legal_name: null })).toBe(true);
    expect(isProfileComplete({ ...base, has_criminal_record: true, criminal_record_details: null })).toBe(true);
  });

  it("accepts the structured address (street + house number + city) without the legacy country field", () => {
    expect(isProfileComplete({ ...base, country: null })).toBe(true);
  });

  it("rejects an incomplete structured address when the legacy country is also empty", () => {
    expect(isProfileComplete({ ...base, country: null, street: null })).toBe(false);
    expect(isProfileComplete({ ...base, country: null, house_number: "" })).toBe(false);
    expect(isProfileComplete({ ...base, country: null, residential_city: null })).toBe(false);
  });

  it("treats a legacy profile with only the country field as complete (backward compat)", () => {
    const legacy = { ...base, street: null, house_number: null, residential_city: null };
    expect(isProfileComplete(legacy)).toBe(true);
  });
});
