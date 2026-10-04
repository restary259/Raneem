import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { jsonLdScript, pickLang, routeText } from "./routeMeta";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("routeText", () => {
  it("resolves a common-namespace key in the active language", () => {
    i18n.addResource("ar", "common", "__route_probe", "نص عربي");
    i18n.addResource("en", "common", "__route_probe", "English text");
    i18n.language = "en";
    expect(routeText("__route_probe")).toBe("English text");
  });

  it("falls back to Arabic for an unsupported active language", () => {
    i18n.addResource("ar", "common", "__route_probe", "نص عربي");
    i18n.language = "fr";
    expect(routeText("__route_probe")).toBe("نص عربي");
  });

  it("returns the key itself when it is missing everywhere", () => {
    expect(routeText("__definitely_missing_route_key")).toBe(
      "__definitely_missing_route_key",
    );
  });

  it("reads from a custom namespace", () => {
    i18n.addResource("ar", "landing", "__route_ns_probe", "قيمة");
    i18n.language = "ar";
    expect(routeText("__route_ns_probe", "landing")).toBe("قيمة");
  });
});

describe("pickLang", () => {
  const dicts = { ar: "ar-value", en: "en-value", he: "he-value" } as const;

  it("returns the active language entry", () => {
    i18n.language = "he";
    expect(pickLang(dicts)).toBe("he-value");
  });

  it("defaults to Arabic for an unsupported language", () => {
    i18n.language = "de";
    expect(pickLang(dicts)).toBe("ar-value");
  });
});

describe("jsonLdScript", () => {
  it("builds an ld+json script tag with a serialized payload", () => {
    const result = jsonLdScript({ "@type": "Organization", name: "Darb" });
    expect(result.type).toBe("application/ld+json");
    expect(JSON.parse(result.children)).toEqual({
      "@type": "Organization",
      name: "Darb",
    });
  });

  it("escapes < so a locale string cannot terminate the script tag", () => {
    const result = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(result.children).not.toContain("</script>");
    expect(result.children).toContain("\\u003c");
    expect(JSON.parse(result.children).name).toBe(
      "</script><script>alert(1)</script>",
    );
  });
});
