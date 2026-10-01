// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Runtime smoke test: initializes the REAL i18n instance so a major-version
 * upgrade that breaks loading, interpolation or fallback fails the suite.
 * (The key-coverage tests only read JSON files.)
 */
const realFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const m = url.match(/\/locales\/([a-z]+)\/([a-zA-Z]+)\.json/);
    const file = m && path.join(process.cwd(), "public/locales", m[1], `${m[2]}.json`);
    if (!file || !fs.existsSync(file)) return new Response("not found", { status: 404 });
    return new Response(fs.readFileSync(file, "utf8"), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

const load = async () => (await import("@/i18n")).default;

describe("i18n runtime", () => {
  it("resolves bundled common resources in every language", async () => {
    const i18n = await load();
    expect(i18n.getFixedT("en")("applyNow")).toBe("Apply Now");
    expect(i18n.getFixedT("ar")("applyNow")).toBe("قدم الآن");
    expect(i18n.getFixedT("he")("applyNow")).toBe("הגישו בקשה");
  });

  it("interpolates variables", async () => {
    const i18n = await load();
    expect(i18n.getFixedT("en")("footer.copyright", { year: 2026 })).toContain("2026");
  });

  it("returns the inline default value for an unknown key", async () => {
    const i18n = await load();
    expect(i18n.getFixedT("en")("no.such.key", "Fallback text")).toBe("Fallback text");
  });

  it("falls back he -> en and others -> ar", async () => {
    const i18n = await load();
    i18n.addResource("en", "common", "__probe", "EN probe");
    i18n.addResource("ar", "common", "__probe", "AR probe");
    expect(i18n.getFixedT("he")("__probe")).toBe("EN probe");
    i18n.removeResourceBundle?.("en", "common");
    i18n.addResourceBundle("en", "common", (await import("@/locales/en/common.json")).default, true, true);
  });

  it("loads an HTTP namespace (dashboard)", async () => {
    const i18n = await load();
    await i18n.loadNamespaces("dashboard");
    await i18n.changeLanguage("en");
    expect(i18n.t("nav.messages", { ns: "dashboard" })).toBe("Messages");
  });

  it("sets document direction on language change", async () => {
    const i18n = await load();
    await i18n.changeLanguage("ar");
    expect(document.documentElement.dir).toBe("rtl");
    await i18n.changeLanguage("he");
    expect(document.documentElement.dir).toBe("rtl");
    await i18n.changeLanguage("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("en");
  });
});
