import { describe, it, expect } from "vitest";
import {
  COURSE_DURATION_WEEKS,
  EMPTY_STUDENT_PROFILE,
  PROFILE_FIELD_LABEL_KEYS,
  REQUIRED_PROFILE_FIELDS,
  StudentProfileValues,
  courseEndFrom,
  fullNameOf,
  isProfileComplete,
  isValidEmail,
  isValidPhone,
  missingProfileFields,
  normalizeEmail,
  readStudentProfile,
  toExtraData,
} from "./studentProfileFields";

const completeProfile: StudentProfileValues = {
  ...EMPTY_STUDENT_PROFILE,
  first_name: "Sami",
  last_name: "Khoury",
  date_of_birth: "2000-05-01",
  student_email: "Sami@Example.com",
  student_phone: "054-123-4567",
  school_id: "school-1",
  program_id: "program-1",
  accommodation_id: "acc-1",
  insurance_id: "ins-1",
};

describe("courseEndFrom", () => {
  it("adds exactly forty weeks to the start date", () => {
    expect(courseEndFrom("2026-09-01")).toBe("2027-06-08");
  });

  it("returns an empty string for a missing or unparseable start", () => {
    expect(courseEndFrom("")).toBe("");
    expect(courseEndFrom("not-a-date")).toBe("");
  });

  it("keeps the documented course length", () => {
    expect(COURSE_DURATION_WEEKS).toBe(40);
  });
});

describe("normalizeEmail / isValidEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Sami@Example.COM ")).toBe("sami@example.com");
    expect(normalizeEmail(null as unknown as string)).toBe("");
  });

  it("accepts an address with a real tld and rejects malformed ones", () => {
    expect(isValidEmail(" Sami@Example.com ")).toBe(true);
    expect(isValidEmail("sami@example")).toBe(false);
    expect(isValidEmail("sami@example.c")).toBe(false);
    expect(isValidEmail("sami example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("accepts 7 to 15 digits with common separators", () => {
    expect(isValidPhone("054-123-4567")).toBe(true);
    expect(isValidPhone("+972 (54) 123 4567")).toBe(true);
  });

  it("rejects letters, short and long numbers", () => {
    expect(isValidPhone("054-123-45ab")).toBe(false);
    expect(isValidPhone("123456")).toBe(false);
    expect(isValidPhone("1234567890123456")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("readStudentProfile", () => {
  it("prefers canonical columns over extra_data", () => {
    const values = readStudentProfile(
      { education_level: "bagrut", passport_type: "israeli", city: "Haifa", phone_number: "0500000000" },
      {
        student_email: "canonical@example.com",
        program_id: "program-canonical",
        program_start_date: "2026-09-01",
        program_end_date: "2027-06-08",
        extra_data: {
          education_level: "old",
          student_email: "stale@example.com",
          program_id: "program-stale",
        },
      },
    );

    expect(values.education_level).toBe("bagrut");
    expect(values.student_email).toBe("canonical@example.com");
    expect(values.program_id).toBe("program-canonical");
    expect(values.city).toBe("Haifa");
    expect(values.student_phone).toBe("0500000000");
  });

  it("splits a legacy full_name into first/middle/last", () => {
    expect(readStudentProfile({ full_name: "Sami Khoury" }, null)).toMatchObject({
      first_name: "Sami",
      middle_name: "",
      last_name: "Khoury",
    });
    expect(readStudentProfile({ full_name: "Sami Nabil Khoury" }, null)).toMatchObject({
      first_name: "Sami",
      middle_name: "Nabil",
      last_name: "Khoury",
    });
  });

  it("returns blanks when there is no case and no submission", () => {
    expect(readStudentProfile(null, null)).toEqual(EMPTY_STUDENT_PROFILE);
  });
});

describe("toExtraData", () => {
  it("never erases a stored value with an empty field", () => {
    const merged = toExtraData({ ...EMPTY_STUDENT_PROFILE, first_name: "" }, { first_name: "Sami" });
    expect(merged.first_name).toBe("Sami");
  });

  it("normalises the email and rebuilds the joined address", () => {
    const merged = toExtraData({
      ...completeProfile,
      street: "Herzl",
      house_no: "12",
      postcode: "3000",
      city: "Haifa",
    });
    expect(merged.student_email).toBe("sami@example.com");
    expect(merged.address).toBe("Herzl, 12, 3000, Haifa");
  });

  it("keeps unrelated previous keys", () => {
    expect(toExtraData(completeProfile, { legacy_note: "keep me" }).legacy_note).toBe("keep me");
  });
});

describe("fullNameOf", () => {
  it("joins the name parts that are present", () => {
    expect(fullNameOf(completeProfile)).toBe("Sami Khoury");
    expect(fullNameOf({ ...completeProfile, middle_name: "Nabil" })).toBe("Sami Nabil Khoury");
    expect(fullNameOf(EMPTY_STUDENT_PROFILE)).toBe("");
  });
});

describe("missingProfileFields", () => {
  it("passes a complete profile", () => {
    expect(missingProfileFields(completeProfile)).toEqual([]);
    expect(isProfileComplete(completeProfile)).toBe(true);
  });

  it("lists every empty required field", () => {
    expect(missingProfileFields(EMPTY_STUDENT_PROFILE)).toEqual(REQUIRED_PROFILE_FIELDS);
    expect(isProfileComplete(EMPTY_STUDENT_PROFILE)).toBe(false);
  });

  it("flags a malformed email or phone exactly once", () => {
    const missing = missingProfileFields({
      ...completeProfile,
      student_email: "sami@example",
      student_phone: "123",
    });
    expect(missing).toEqual(["student_email", "student_phone"]);
  });

  it("labels every field for error messages", () => {
    for (const field of Object.keys(EMPTY_STUDENT_PROFILE) as (keyof StudentProfileValues)[]) {
      expect(PROFILE_FIELD_LABEL_KEYS[field]).toBeTruthy();
    }
  });
});
