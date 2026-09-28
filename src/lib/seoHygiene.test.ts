import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DARB_OFFICE } from "@/config/localBusiness";

const ROOT = process.cwd();
const sitemap = fs.readFileSync(
  path.join(ROOT, "public", "sitemap.xml"),
  "utf8",
);
const robots = fs.readFileSync(path.join(ROOT, "public", "robots.txt"), "utf8");

describe("public sitemap", () => {
  it("never advertises the removed /who-we-are 404", () => {
    expect(sitemap).not.toContain("/who-we-are");
  });

  it("lists the real /about page", () => {
    expect(sitemap).toContain("<loc>https://darb.agency/about</loc>");
  });

  it("gives every entry a lastmod", () => {
    const urls = sitemap.match(/<url>[\s\S]*?<\/url>/g) ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    }
  });
});

describe("public robots.txt", () => {
  it.each([
    "/admin",
    "/team",
    "/partner",
    "/agent",
    "/invoice",
    "/student-auth",
    "/apply",
    "/join",
  ])("disallows the private route family %s", (route) => {
    expect(robots).toContain(`Disallow: ${route}`);
  });

  it("points at the canonical sitemap", () => {
    expect(robots).toContain("Sitemap: https://darb.agency/sitemap.xml");
  });

  it("does not let the /partner prefix hide the public /partnership page", () => {
    // robots.txt matching is prefix-based, so `Disallow: /partner` also matches
    // `/partnership` (and `/partners`). Both are public pages the sitemap
    // advertises, so they must be re-allowed and the longest-match rule must
    // resolve to Allow.
    const rules = robots
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^(Allow|Disallow):/.test(line))
      .map((line) => {
        const index = line.indexOf(":");
        return {
          kind: line.slice(0, index),
          value: line.slice(index + 1).trim(),
        };
      });

    const matchFor = (target: string) => {
      let best: { kind: string; value: string } | null = null;
      for (const rule of rules) {
        if (
          rule.value &&
          (target === rule.value || target.startsWith(rule.value))
        ) {
          if (!best || rule.value.length > best.value.length) best = rule;
        }
      }
      return best?.kind;
    };

    expect(matchFor("/partnership")).toBe("Allow");
    expect(matchFor("/partners")).toBe("Allow");
    expect(matchFor("/partner/earnings")).toBe("Disallow");
  });
});

describe("Darb local entity", () => {
  it("publishes an Israeli postal address", () => {
    expect(DARB_OFFICE.addressCountry).toBe("IL");
    expect(DARB_OFFICE.addressLocality).toBe("Tamra");
    expect(DARB_OFFICE.telephone.startsWith("+")).toBe(true);
  });
});

describe("root structured data is server-rendered", () => {
  const root = fs.readFileSync(
    path.join(ROOT, "src", "routes", "__root.tsx"),
    "utf8",
  );

  it("emits the JSON-LD graph through head() scripts, not a client effect", () => {
    // TanStack Router serializes `scripts` in head() into the SSR HTML; a
    // document.head mutation in useEffect is invisible to non-JS crawlers.
    expect(root).toMatch(/scripts:\s*\[[\s\S]*type:\s*"application\/ld\+json"/);
    expect(root).not.toContain("rootJsonld");
  });

  it("ties the organization to the Israel office and audience", () => {
    expect(root).toContain("DARB_OFFICE");
    expect(root).toMatch(/name:\s*"Israel"/);
    expect(root).toMatch(/areaServed:\s*"IL"/);
  });
});
