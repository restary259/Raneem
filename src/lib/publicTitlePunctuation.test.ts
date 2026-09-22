import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PUBLIC_LOCALES = path.join(ROOT, "public/locales");

const isTitleKey = (key: string) => {
  const normalized = key.toLowerCase();
  return (
    normalized === "title" ||
    (normalized.endsWith("title") && !normalized.endsWith("subtitle")) ||
    normalized === "heading" ||
    normalized === "headline" ||
    normalized === "campaign"
  );
};

const collectTrailingFullStops = (
  value: unknown,
  location: string,
  invalid: string[],
) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectTrailingFullStops(item, `${location}.${index}`, invalid),
    );
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    if (typeof child === "string" && isTitleKey(key) && child.trimEnd().endsWith(".")) {
      invalid.push(childLocation);
    }
    collectTrailingFullStops(child, childLocation, invalid);
  }
};

describe("public title punctuation", () => {
  it("does not end declarative titles with a full stop", () => {
    const invalid: string[] = [];

    for (const language of fs.readdirSync(PUBLIC_LOCALES)) {
      const languageDir = path.join(PUBLIC_LOCALES, language);
      if (!fs.statSync(languageDir).isDirectory()) continue;

      for (const file of fs.readdirSync(languageDir).filter((name) => name.endsWith(".json"))) {
        const dictionary = JSON.parse(
          fs.readFileSync(path.join(languageDir, file), "utf8"),
        ) as unknown;
        collectTrailingFullStops(dictionary, `${language}/${file}`, invalid);
      }
    }

    expect(invalid).toEqual([]);
  });
});
