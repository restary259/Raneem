import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { EmailAPIError, sendLovableEmail } = vi.hoisted(() => {
  class EmailAPIError extends Error {
    constructor(
      public code: string,
      message = code,
    ) {
      super(message);
      this.name = "EmailAPIError";
    }
  }
  return { EmailAPIError, sendLovableEmail: vi.fn() };
});

vi.mock("@lovable.dev/email-js", () => ({ EmailAPIError, sendLovableEmail }));

import { TEMPLATES } from "./registry";
import { sendTemplateEmail } from "./send-email";

const originalKey = process.env.LOVABLE_API_KEY;
const addedKeys: string[] = [];

/** Registers a temporary template variant derived from a real, renderable one. */
function addTemplate(name: string, overrides: Record<string, unknown>) {
  TEMPLATES[name] = { ...TEMPLATES["new-message"], ...overrides } as never;
  addedKeys.push(name);
}

beforeEach(() => {
  process.env.LOVABLE_API_KEY = "test-key";
  sendLovableEmail.mockReset();
  sendLovableEmail.mockResolvedValue(undefined);
});

afterEach(() => {
  for (const key of addedKeys.splice(0)) delete TEMPLATES[key];
  if (originalKey === undefined) delete process.env.LOVABLE_API_KEY;
  else process.env.LOVABLE_API_KEY = originalKey;
  vi.restoreAllMocks();
});

describe("sendTemplateEmail", () => {
  it("throws when LOVABLE_API_KEY is not configured", async () => {
    delete process.env.LOVABLE_API_KEY;
    await expect(sendTemplateEmail("new-message", "a@b.co")).rejects.toThrow(
      "LOVABLE_API_KEY is not configured",
    );
    expect(sendLovableEmail).not.toHaveBeenCalled();
  });

  it("throws for an unknown template and lists the available ones", async () => {
    await expect(sendTemplateEmail("nope", "a@b.co")).rejects.toThrow(
      /Template 'nope' not found\. Available: /,
    );
  });

  it("renders html and plain text and sends through Lovable", async () => {
    const result = await sendTemplateEmail(
      "new-message",
      "student@example.com",
      {
        templateData: { recipientName: "Layla", threadTitle: "DARB-1" },
      },
    );

    expect(result).toEqual({ sent: true });
    const payload = sendLovableEmail.mock.calls[0][0];
    expect(payload.to).toBe("student@example.com");
    expect(payload.from).toBe("Darb Study International <noreply@darb.agency>");
    expect(payload.sender_domain).toBe("support.darb.agency");
    expect(payload.purpose).toBe("transactional");
    expect(payload.label).toBe("new-message");
    expect(payload.html).toContain("Layla");
    expect(payload.text).toContain("Layla");
    expect(typeof payload.idempotency_key).toBe("string");
  });

  it("resolves a function subject with the template data", async () => {
    await sendTemplateEmail("new-message", "a@b.co", {
      templateData: { threadTitle: "DARB-1042" },
    });
    expect(sendLovableEmail.mock.calls[0][0].subject).toContain("DARB-1042");
  });

  it("uses a string subject as-is", async () => {
    addTemplate("string-subject", { subject: "Plain subject" });
    await sendTemplateEmail("string-subject", "a@b.co");
    expect(sendLovableEmail.mock.calls[0][0].subject).toBe("Plain subject");
  });

  it("honours an explicit idempotency key and reply-to", async () => {
    await sendTemplateEmail("new-message", "a@b.co", {
      idempotencyKey: "key-1",
      replyTo: "reply@darb.agency",
    });
    const payload = sendLovableEmail.mock.calls[0][0];
    expect(payload.idempotency_key).toBe("key-1");
    expect(payload.reply_to).toBe("reply@darb.agency");
  });

  it("lets a template's fixed recipient override the caller's", async () => {
    addTemplate("fixed-recipient", { to: "ops@darb.agency" });
    await sendTemplateEmail("fixed-recipient", "student@example.com");
    expect(sendLovableEmail.mock.calls[0][0].to).toBe("ops@darb.agency");
  });

  it("throws when no recipient can be resolved", async () => {
    await expect(sendTemplateEmail("new-message", "")).rejects.toThrow(
      "Recipient is required (the template defines no fixed recipient)",
    );
  });

  it("reports a suppressed recipient as an expected outcome", async () => {
    sendLovableEmail.mockRejectedValueOnce(
      new EmailAPIError("recipient_suppressed", "suppressed"),
    );
    await expect(sendTemplateEmail("new-message", "a@b.co")).resolves.toEqual({
      sent: false,
      reason: "recipient_suppressed",
    });
  });

  it("rethrows any other provider error", async () => {
    sendLovableEmail.mockRejectedValueOnce(
      new EmailAPIError("rate_limited", "slow down"),
    );
    await expect(sendTemplateEmail("new-message", "a@b.co")).rejects.toThrow(
      "slow down",
    );
  });
});
