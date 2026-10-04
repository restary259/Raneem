import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import * as React from "react";
import { FALLBACK_TEMPLATE, TEMPLATES } from "./registry";
import { template as accountInvite } from "./account-invite";

describe("email template registry", () => {
  it("uses the account-invite template as the branded fallback", () => {
    expect(FALLBACK_TEMPLATE).toBe(accountInvite);
  });

  it("registers every template under its documented key", () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(
      [
        "account-invite",
        "agent-invite",
        "ambassador-invite",
        "appointment-reminder",
        "case-invoice",
        "email-test",
        "new-message",
        "partner-invite",
        "student-invite",
        "team-invite",
      ].sort(),
    );
  });

  it("gives every entry a component and a subject", () => {
    for (const [key, entry] of Object.entries(TEMPLATES)) {
      expect(entry.component, key).toBeTruthy();
      expect(["string", "function"]).toContain(typeof entry.subject);
    }
  });

  it("renders every template with its preview data", async () => {
    for (const [key, entry] of Object.entries(TEMPLATES)) {
      const element = React.createElement(
        entry.component,
        entry.previewData ?? {},
      );
      const html = await render(element);
      expect(html, key).toMatch(/darb\.agency|درب/i);
    }
  });

  it("resolves a string subject and a function subject", () => {
    const stringEntry = Object.values(TEMPLATES).find(
      (e) => typeof e.subject === "string",
    );
    const fnEntry = Object.values(TEMPLATES).find(
      (e) => typeof e.subject === "function",
    );
    expect(stringEntry).toBeTruthy();
    expect(fnEntry).toBeTruthy();
    if (typeof fnEntry?.subject === "function") {
      expect(typeof fnEntry.subject({})).toBe("string");
    }
  });
});
