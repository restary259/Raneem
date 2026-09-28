import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { jsonLdScript } from "@/lib/routeMeta";

const ROUTES = path.join(process.cwd(), "src", "routes");
const read = (file: string) => fs.readFileSync(path.join(ROUTES, file), "utf8");

const PUBLIC_ROUTES = [
  "about.tsx",
  "contact.tsx",
  "locations.tsx",
  "partnership.tsx",
  "services.tsx",
  "faq.tsx",
  "resources.index.tsx",
  "educational-programs.tsx",
  "educational-destinations.tsx",
  "blog.index.tsx",
  "blog.$slug.tsx",
];

describe("jsonLdScript", () => {
  it("emits an ld+json script payload", () => {
    const script = jsonLdScript({ "@type": "Thing", name: "درب" });
    expect(script.type).toBe("application/ld+json");
    expect(JSON.parse(script.children)).toEqual({
      "@type": "Thing",
      name: "درب",
    });
  });

  it("escapes < so a locale string cannot close the script tag", () => {
    const script = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(script.children).not.toContain("</script>");
    expect(script.children).toContain("\\u003c");
  });
});

describe("public page structured data is server-rendered", () => {
  // The SEOHead jsonLd prop is applied by a client effect, so a crawler that
  // does not run JavaScript never sees it. Public pages must emit schema
  // through their route head() instead.
  it("no public page passes jsonLd to SEOHead", () => {
    const pagesDir = path.join(process.cwd(), "src", "pages");
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.name.endsWith(".tsx") ? [full] : [];
      });
    for (const file of walk(pagesDir)) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, `${file} still passes jsonLd to SEOHead`).not.toMatch(
        /jsonLd=\{/,
      );
    }
  });

  it.each(PUBLIC_ROUTES)("%s emits a head() with scripts", (file) => {
    const source = read(file);
    expect(source).toMatch(/head:\s*\(/);
    expect(source).toMatch(/scripts:\s*\[/);
    expect(source).toMatch(/jsonLdScript\(/);
  });

  it.each([
    "about.tsx",
    "contact.tsx",
    "locations.tsx",
    "partnership.tsx",
    "services.tsx",
    "faq.tsx",
    "resources.index.tsx",
    "educational-programs.tsx",
    "educational-destinations.tsx",
    "blog.index.tsx",
    "blog.$slug.tsx",
  ])("%s emits a BreadcrumbList", (file) => {
    const source = read(file);
    expect(source).toMatch(/BreadcrumbList|buildBreadcrumbList/);
  });
});

describe("head() sources non-bundled namespaces from imported locale JSON", () => {
  // routeText() only reaches eagerly-bundled namespaces. faq/services/blog are
  // fetched on demand, so a route head() that needs them must import the JSON.
  it.each([
    ["faq.tsx", "faq"],
    ["services.tsx", "services"],
    ["blog.index.tsx", "blog"],
    ["blog.$slug.tsx", "blog"],
  ])("%s imports the %s locale JSON", (file, ns) => {
    const source = read(file);
    expect(source).toMatch(
      new RegExp(`public/locales/ar/${ns}\\.json`),
    );
  });

  it("does not hardcode Arabic meta literals in the localized routes", () => {
    // Guards against regressing to duplicated literals now that the values are
    // sourced from the locale dictionaries.
    for (const file of ["faq.tsx", "services.tsx", "blog.index.tsx"]) {
      const source = read(file);
      expect(source, file).not.toMatch(/title:\s*"[^"]*[\u0600-\u06FF]/);
    }
  });
});
