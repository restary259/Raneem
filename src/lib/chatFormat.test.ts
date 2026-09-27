import { describe, it, expect } from "vitest";
import {
  BANK_DETAILS_MARKER,
  buildBankDetailsBody,
  parseBankDetailsBody,
  hasBankDetails,
  type BankDetailsPayload,
} from "./chatFormat";

const IL: BankDetailsPayload = {
  bankCountry: "il",
  bankHolder: "Moshe Cohen",
  bankName: "Bank Hapoalim",
  bankBranch: "123",
  bankAccount: "456789",
  iban: "IL620108000000099999999",
  bic: "",
};

const DE: BankDetailsPayload = {
  bankCountry: "de",
  bankHolder: "Anna Schmidt",
  bankName: "Commerzbank",
  bankBranch: "",
  bankAccount: "",
  iban: "DE89370400440532013000",
  bic: "COBADEFFXXX",
};

describe("chatFormat bank-details share", () => {
  it("round-trips complete Israeli details", () => {
    const body = buildBankDetailsBody(IL);
    expect(body.startsWith(BANK_DETAILS_MARKER)).toBe(true);
    expect(parseBankDetailsBody(body)).toEqual(IL);
  });

  it("round-trips German details including BIC", () => {
    const body = buildBankDetailsBody(DE);
    const parsed = parseBankDetailsBody(body);
    expect(parsed).toEqual(DE);
    expect(parsed?.bic).toBe("COBADEFFXXX");
  });

  it("reports empty details as not shareable", () => {
    expect(hasBankDetails(null)).toBe(false);
    expect(
      hasBankDetails({ bankCountry: "il", bankHolder: "", bankName: "", bankBranch: "", bankAccount: "", iban: "", bic: "" }),
    ).toBe(false);
    expect(hasBankDetails(IL)).toBe(true);
  });

  it("returns null for a plain-text message", () => {
    expect(parseBankDetailsBody("hello")).toBeNull();
    expect(parseBankDetailsBody(null)).toBeNull();
  });

  it("returns null when the marker is present but the JSON line is malformed or missing", () => {
    expect(parseBankDetailsBody(`${BANK_DETAILS_MARKER}\nnot-json\n\nBank name: —`)).toBeNull();
    expect(parseBankDetailsBody(`${BANK_DETAILS_MARKER}\n\nBank name: —`)).toBeNull();
  });

  it("keeps the human-readable fallback block for admins", () => {
    const body = buildBankDetailsBody(IL);
    expect(body).toContain("Account holder: Moshe Cohen");
    expect(body).toContain("Bank name: Bank Hapoalim");
    expect(body).toContain("IBAN: IL620108000000099999999");
    // blank fields render the em-dash placeholder, never "undefined"
    const deBody = buildBankDetailsBody(DE);
    expect(deBody).toContain("Branch: —");
    expect(deBody).not.toContain("undefined");
  });
});
