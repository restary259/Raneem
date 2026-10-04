import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type InsertRow = Record<string, unknown>;
let inserted: InsertRow[] = [];
let insertError: { message: string } | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "consent_records")
        throw new Error(`unexpected from(${table})`);
      return {
        insert: (row: InsertRow) => {
          inserted.push(row);
          return Promise.resolve({ error: insertError });
        },
      };
    },
  },
}));

import { POLICY_VERSION, recordConsent, type ConsentInput } from "./consent";

const baseInput: ConsentInput = {
  sourceForm: "apply_page",
  subjectName: "  Layla Haddad ",
  phone: "  +972500000000 ",
  email: "  Layla@Example.COM ",
  serviceContact: true,
  marketing: false,
};

beforeEach(() => {
  inserted = [];
  insertError = null;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordConsent", () => {
  it("trims and lowercases identity fields and stamps the policy version", async () => {
    await recordConsent(baseInput);

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      source_form: "apply_page",
      subject_name: "Layla Haddad",
      phone: "+972500000000",
      email: "layla@example.com",
      user_id: null,
      policy_version: POLICY_VERSION,
      service_contact_consent: true,
      marketing_consent: false,
      locale: null,
    });
  });

  it("defaults marketing channels only when marketing consent is given", async () => {
    await recordConsent({ ...baseInput, marketing: false });
    expect(inserted[0].marketing_channels).toEqual({});

    await recordConsent({ ...baseInput, marketing: true });
    expect(inserted[1].marketing_channels).toEqual({
      email: true,
      whatsapp: true,
      sms: false,
    });
  });

  it("honours an explicit marketing channel map", async () => {
    await recordConsent({
      ...baseInput,
      marketing: true,
      marketingChannels: { email: false, sms: true },
    });
    expect(inserted[0].marketing_channels).toEqual({ email: false, sms: true });
  });

  it("records nulls for missing optional fields", async () => {
    await recordConsent({
      sourceForm: "contact_form",
      serviceContact: true,
      marketing: false,
    });
    expect(inserted[0]).toMatchObject({
      subject_name: null,
      phone: null,
      email: null,
      locale: null,
    });
  });

  it("never throws when the insert fails (append-only best effort)", async () => {
    insertError = { message: "permission denied" };
    await expect(recordConsent(baseInput)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      "[consent] failed to record consent:",
      "permission denied",
    );
  });

  it("swallows a thrown insert error too", async () => {
    vi.resetModules();
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: {
        from: () => ({
          insert: () => {
            throw new Error("network down");
          },
        }),
      },
    }));
    const { recordConsent: fresh } = await import("./consent");
    await expect(
      fresh({
        sourceForm: "partnership_form",
        serviceContact: true,
        marketing: false,
      }),
    ).resolves.toBeUndefined();
    vi.doUnmock("@/integrations/supabase/client");
  });
});
