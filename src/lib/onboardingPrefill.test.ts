import { describe, expect, it } from "vitest";
import { buildCasePrefill, mergeCasePrefill } from "@/lib/onboardingPrefill";

const caseRow = {
  full_name: "Sara Haddad",
  phone_number: "+972501112233",
  city: "Nazareth",
};

const submission = {
  student_phone: "+972509998877",
  extra_data: {
    date_of_birth: "2002-04-01",
    gender: "female",
    city_of_birth: "Haifa",
    street: "Olive Street",
    house_no: "12",
    city: "Nazareth",
    school_id: "school-1",
    start_month: "October 2026",
    emergency_contact_name: "Amal",
    emergency_contact_phone: "+972501234567",
  },
};

describe("buildCasePrefill", () => {
  it("maps case + submission values onto the wizard shape", () => {
    const { values, contact, hasData } = buildCasePrefill(caseRow, submission, ["school-1"]);
    expect(hasData).toBe(true);
    expect(values).toMatchObject({
      full_name: "Sara Haddad",
      phone_number: "+972509998877",
      date_of_birth: "2002-04-01",
      gender: "female",
      city: "Haifa",
      street: "Olive Street",
      house_number: "12",
      residential_city: "Nazareth",
      language_school_id: "school-1",
      intake_month: "October 2026",
    });
    expect(contact).toEqual({ name: "Amal", relationship: "", phone: "+972501234567" });
  });

  it("ignores a school that is no longer offered in the dropdown", () => {
    const { values } = buildCasePrefill(caseRow, submission, ["other-school"]);
    expect(values.language_school_id).toBeUndefined();
  });

  it("returns no data when there is no case", () => {
    expect(buildCasePrefill(null, null)).toEqual({ values: {}, contact: null, hasData: false });
  });

  it("skips an incomplete emergency contact", () => {
    const { contact } = buildCasePrefill(caseRow, { extra_data: { emergency_contact_name: "Amal" } }, []);
    expect(contact).toBeNull();
  });
});

describe("mergeCasePrefill", () => {
  it("fills blanks only and never overwrites the student's own value", () => {
    const merged = mergeCasePrefill(
      { full_name: "Sara H.", gender: null, city: "" },
      { full_name: "Sara Haddad", gender: "female", city: "Haifa" },
    );
    expect(merged).toEqual({ full_name: "Sara H.", gender: "female", city: "Haifa" });
  });
});
