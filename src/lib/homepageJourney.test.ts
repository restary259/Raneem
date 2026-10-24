import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LOCALES = ["ar", "en", "he"] as const;

const read = (p: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

const landing = (base: string, lang: string) =>
  read(`${base}/locales/${lang}/landing.json`) as {
    homepage: {
      roadmap: {
        eyebrow: string;
        title: string;
        body: string;
        progressLabel: string;
        tapHint: string;
        detailsLabel: string;
        stages: Array<{
          title: string;
          body: string;
          darb: string;
          note?: string;
          action: string;
          href: string;
        }>;
      };
      celebration: {
        eyebrow: string;
        title: string;
        body: string;
        reassurance: string;
        cta: string;
        close: string;
      };
    };
  };

/** Every real public route, taken from the generated route tree. */
const routePaths = (): Set<string> => {
  const tree = fs.readFileSync(path.join(ROOT, "src/routeTree.gen.ts"), "utf8");
  const paths = new Set<string>();
  for (const m of tree.matchAll(/\b(?:fullPath|path):\s*'([^']+)'/g)) {
    const p = m[1];
    paths.add(p.startsWith("/") ? p : `/${p}`);
  }
  return paths;
};

describe("homepage journey roadmap", () => {
  it("ships six stations in every supported language", () => {
    for (const lang of LOCALES) {
      for (const base of ["public", "src"]) {
        const stages = landing(base, lang).homepage.roadmap.stages;
        expect(stages, `${base}/${lang} stage count`).toHaveLength(6);
      }
    }
  });

  it("fills every station field with real copy", () => {
    for (const lang of LOCALES) {
      landing("public", lang).homepage.roadmap.stages.forEach(
        (stage, index) => {
          for (const field of ["title", "body", "darb", "action"] as const) {
            expect(
              stage[field]?.trim(),
              `${lang} stage ${index} ${field}`,
            ).toBeTruthy();
          }
        },
      );
    }
  });

  it("links every station to a route that actually exists", () => {
    const paths = routePaths();
    for (const lang of LOCALES) {
      landing("public", lang).homepage.roadmap.stages.forEach((stage) => {
        expect(
          paths.has(stage.href),
          `${lang} station href ${stage.href}`,
        ).toBe(true);
      });
    }
  });

  it("uses the same station links across all languages", () => {
    const hrefs = (lang: string) =>
      landing("public", lang).homepage.roadmap.stages.map((s) => s.href);
    expect(hrefs("en")).toEqual(hrefs("ar"));
    expect(hrefs("he")).toEqual(hrefs("ar"));
  });

  it("keeps the bundled and served Hebrew dictionaries identical", () => {
    const bundled = fs.readFileSync(
      path.join(ROOT, "src/locales/he/landing.json"),
      "utf8",
    );
    const served = fs.readFileSync(
      path.join(ROOT, "public/locales/he/landing.json"),
      "utf8",
    );
    expect(bundled).toBe(served);
  });

  it("labels the disclosure control distinctly from the link it reveals", () => {
    for (const lang of LOCALES) {
      const rm = landing("public", lang).homepage.roadmap;
      expect(rm.detailsLabel?.trim(), `${lang} detailsLabel`).toBeTruthy();
      for (const stage of rm.stages) {
        expect(
          stage.action,
          `${lang}: toggle label must differ from station link "${stage.action}"`,
        ).not.toBe(rm.detailsLabel);
      }
    }
  });

  it("never claims a decision DARB does not make", () => {
    // The admission stage must keep its provider-responsibility note in every language.
    for (const lang of LOCALES) {
      const admission = landing("public", lang).homepage.roadmap.stages[4];
      expect(admission.note?.trim(), `${lang} admission note`).toBeTruthy();
    }
  });

  it("celebrates the journey without promising an outcome", () => {
    const banned = ["visa granted", "accepted", "guarantee", "guaranteed"];
    for (const lang of LOCALES) {
      const { body, reassurance } = landing("public", lang).homepage
        .celebration;
      const text = `${body} ${reassurance}`.toLowerCase();
      for (const phrase of banned) {
        expect(
          text,
          `${lang} celebration must not promise "${phrase}"`,
        ).not.toContain(phrase);
      }
    }
  });
});
