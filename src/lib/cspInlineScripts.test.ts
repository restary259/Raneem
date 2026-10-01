import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Route as RootRoute } from "@/routes/__root";

const ROOT = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const SCRIPT_SRC_UNSAFE_INLINE = /script-src[^;]*'unsafe-inline'/i;
const INLINE_SCRIPT_BLOCK = /<script\b(?![^>]*\bsrc=)[^>]*>\s*[\s\S]*?\S[\s\S]*?<\/script>/i;
const INLINE_EVENT_HANDLER_ATTR = /\son[a-z]+\s*=/i;

describe("CSP script-src hardening", () => {
  it("removes unsafe-inline from script-src in static host headers", () => {
    const netlifyHeaders = read("public", "_headers");
    const vercel = JSON.parse(read("vercel.json")) as {
      headers?: Array<{ headers?: Array<{ key: string; value: string }> }>;
    };
    const vercelCsp = vercel.headers
      ?.flatMap((entry) => entry.headers ?? [])
      .find((entry) => entry.key === "Content-Security-Policy")?.value;

    expect(netlifyHeaders).not.toMatch(SCRIPT_SRC_UNSAFE_INLINE);
    expect(vercelCsp).toBeTruthy();
    expect(vercelCsp).not.toMatch(SCRIPT_SRC_UNSAFE_INLINE);

    for (const host of [
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
    ]) {
      expect(netlifyHeaders).toContain(host);
      expect(vercelCsp).toContain(host);
    }
  });
});

describe("Static HTML inline script guards", () => {
  it("keeps 404 redirect logic in an external script file only", () => {
    const html404 = read("public", "404.html");
    const js404 = read("public", "404.js");

    expect(html404).toContain('<script src="/404.js"></script>');
    expect(html404).not.toMatch(INLINE_SCRIPT_BLOCK);
    expect(js404).toContain("sessionStorage.setItem");
    expect(js404).toContain("location.replace");
  });

  it("keeps offline page logic in an external script and removes inline handlers", () => {
    const offlineHtml = read("public", "offline.html");
    const offlineJs = read("public", "offline.js");

    expect(offlineHtml).toContain('<script src="/offline.js" defer></script>');
    expect(offlineHtml).not.toMatch(INLINE_SCRIPT_BLOCK);
    expect(offlineHtml).not.toMatch(INLINE_EVENT_HANDLER_ATTR);

    expect(offlineJs).toContain("addEventListener(\"online\"");
    expect(offlineJs).toContain("setInterval");
    expect(offlineJs).toContain("retry-button");
  });
});

describe("Application CSP meta coverage", () => {
  it("never restricts script-src in the document meta (would block TanStack hydration)", async () => {
    const head = RootRoute.options.head;
    const rootHead = head
      ? await head({} as Parameters<NonNullable<typeof head>>[0])
      : undefined;
    const cspMeta = rootHead?.meta?.find(
      (entry) => entry?.httpEquiv === "Content-Security-Policy",
    )?.content;

    expect(cspMeta).toBeTypeOf("string");
    expect(cspMeta).not.toMatch(/script-src/i);
    expect(cspMeta).toContain("upgrade-insecure-requests");
  });
});

describe("Application head scripts under strict CSP", () => {
  it("keeps root head scripts non-executable JSON-LD only", async () => {
    const head = RootRoute.options.head;
    const rootHead = head
      ? await head({} as Parameters<NonNullable<typeof head>>[0])
      : undefined;
    const scripts = rootHead?.scripts ?? [];

    expect(scripts.length).toBeGreaterThan(0);

    for (const script of scripts.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))) {
      expect(script.type).toBe("application/ld+json");
      expect(script.children).toBeTypeOf("string");
      if (typeof script.children !== "string") continue;
      const scriptBody = script.children as string;
      expect(scriptBody).not.toContain("<script");
      expect(() => JSON.parse(scriptBody)).not.toThrow();
    }
  });
});
