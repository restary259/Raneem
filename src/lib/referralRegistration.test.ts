import { describe, expect, it } from "vitest";
import {
  buildFullName,
  calculateRegistrationQuote,
  validateRegistrationForm,
  type RegistrationAccommodation,
  type RegistrationFormData,
  type RegistrationProgram,
} from "./referralRegistration";

const program: RegistrationProgram = {
  id: "p1",
  name_en: "German Intensive",
  name_ar: "ألماني مكثف",
  school_id: "s1",
  price: 210,
  currency: "EUR",
  price_tiers: [{ from_weeks: 12, price: 180 }],
  registration_fee: 50,
};

const accommodation: RegistrationAccommodation = {
  id: "a1",
  name_en: "Residence",
  name_ar: "سكن",
  school_id: "s1",
  price: 200,
  currency: "EUR",
  price_tiers: [{ from_weeks: 12, price: 170 }],
  placement_fee: 100,
  photos: [],
};

const base: RegistrationFormData = {
  referral_type: "friend",
  first_name: "Ahmad",
  middle_name: "",
  last_name: "Haddad",
  full_name: "Ahmad Haddad",
  date_of_birth: "2003-04-01",
  gender: "male",
  city_of_birth: "Tamra",
  nationality: "Israeli",
  passport_type: "israeli_blue",
  email: "ahmad@example.com",
  phone: "+972501234567",
  emergency_contact_name: "Parent",
  emergency_contact_phone: "+972501112233",
  street: "",
  house_number: "",
  postcode: "",
  city: "Tamra",
  education_level: "bagrut",
  english_units: "5",
  math_units: "5",
  english_level: "",
  degree_interest: "",
  preferred_major_id: "",
  school_id: "s1",
  program_id: "p1",
  program_weeks: "42",
  start_month: "2026-10",
  accommodation_id: "a1",
  accommodation_weeks: "42",
  insurance_id: "",
  locale: "en",
};

describe("student referral registration helpers", () => {
  it("builds a canonical full name", () => {
    expect(buildFullName({ first_name: "Ahmad", middle_name: "", last_name: "Haddad" })).toBe("Ahmad Haddad");
  });

  it("validates required registration fields", () => {
    expect(validateRegistrationForm({ ...base, email: "", school_id: "" })).toEqual(expect.objectContaining({
      email: expect.any(String),
      school_id: expect.any(String),
    }));
  });

  it("applies the selected 12+ week course and accommodation tiers", () => {
    const quote = calculateRegistrationQuote(program, 42, accommodation, 42, null, base.date_of_birth);
    expect(quote.program.weeklyRate).toBe(180);
    expect(quote.program.total).toBe(7560);
    expect(quote.accommodation.weeklyRate).toBe(170);
    expect(quote.accommodation.total).toBe(7140);
    expect(quote.subtotal).toBe(14850);
  });
});
