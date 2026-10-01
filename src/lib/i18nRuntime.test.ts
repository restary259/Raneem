import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

function stubLocaleFetch() {
  const requests: string[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
      const url = new URL(rawUrl, "http://darb.test");
      const parts = url.pathname.split("/");
      const locale = parts[2];
      const namespace = parts[3]?.replace(/\.json$/, "");

      if (parts.length !== 4 || parts[1] !== "locales" || !["ar", "en", "he"].includes(locale) || namespace !== "dashboard") {
        return new Response("Not found", { status: 404 });
      }


      requests.push(url.pathname);

      const localeFile = path.join(process.cwd(), "public", "locales", locale, namespace + ".json");
      const body = await fs.readFile(localeFile, "utf8");

      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );

  return requests;
}

describe("i18n runtime loading", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    stubLocaleFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads bundled common resources and HTTP-loaded dashboard resources at runtime", async () => {
    const { default: i18n } = await import("../i18n");

    // common is bundled directly in src/i18n.ts, so it must be available
    // without making an HTTP request.
    expect(i18n.hasResourceBundle("ar", "common")).toBe(true);
    expect(i18n.hasResourceBundle("ar", "dashboard")).toBe(false);

    await i18n.loadNamespaces("dashboard");

    // dashboard is intentionally HTTP-loaded on demand; the test exercises
    // the real namespace JSON files rather than a second in-memory fixture.
    expect(i18n.hasResourceBundle("ar", "dashboard")).toBe(true);
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url) === "/locales/ar/dashboard.json"),
    ).toBe(true);

    await i18n.changeLanguage("en");
    expect(i18n.t("nav.home", { ns: "dashboard" })).toBeTypeOf("string");
    expect(i18n.t("referralRegistration.title", { ns: "dashboard" })).toBe("Refer & Register");
  });

  it("covers interpolation and the configured Hebrew-to-English runtime fallback", async () => {
    const { default: i18n } = await import("../i18n");

    await i18n.loadNamespaces("dashboard");

    i18n.addResource("en", "dashboard", "runtimeSmoke.greeting", "Hello {{name}}");
    i18n.addResource("ar", "dashboard", "runtimeSmoke.greeting", "مرحبا {{name}}");
    // Deliberately do not add the key to Hebrew: this verifies the app fallback
    // configuration for a missing Hebrew translation.

    await i18n.changeLanguage("en");
    expect(i18n.t("runtimeSmoke.greeting", { ns: "dashboard", name: "Raneem" })).toBe("Hello Raneem");

    await i18n.changeLanguage("ar");
    expect(i18n.t("runtimeSmoke.greeting", { ns: "dashboard", name: "Raneem" })).toBe("مرحبا Raneem");

    await i18n.changeLanguage("he");
    expect(i18n.t("runtimeSmoke.greeting", { ns: "dashboard", name: "Raneem" })).toBe("Hello Raneem");
  });
});
