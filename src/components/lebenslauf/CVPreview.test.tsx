import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import CVPreview from "./CVPreview";
import { createEmptyCVData } from "./types";
import enResources from "../../../public/locales/en/resources.json";

// The component calls t("lebenslaufBuilder.pageLabel", "Page") for the
// page-break chip; resolve it against the real en dictionary.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const segs = key.split(".");
      let cur: any = enResources;
      for (const s of segs) cur = cur?.[s];
      return typeof cur === "string" ? cur : fallback ?? key;
    },
  }),
}));

const templates = ["german-standard", "academic", "europass", "modern-sidebar"] as const;

describe("CVPreview scaled/capture contract", () => {
  it.each(templates)("mounts the %s template in both scaled and capture copies", (template) => {
    const data = { ...createEmptyCVData(), template };

    const { container: scaledContainer } = render(<CVPreview data={data} />);
    expect(scaledContainer.querySelector("#cv-preview")).toBeTruthy();

    const { container: captureContainer } = render(
      <CVPreview data={data} id="cv-capture" scaled={false} />
    );
    expect(captureContainer.querySelector("#cv-capture")).toBeTruthy();
  });

  it("renders the same template body in both copies (no silent divergence)", () => {
    const data = { ...createEmptyCVData(), template: "german-standard" as const };
    const { container: scaledC } = render(<CVPreview data={data} />);
    const { container: captureC } = render(
      <CVPreview data={data} id="cv-capture" scaled={false} />
    );
    // The template-specific sheet root (cv-preview-container) must be present
    // in both — guards against a future template being added to one branch
    // but not the other (the PDF would silently render the wrong template).
    expect(scaledC.querySelectorAll(".cv-preview-container")).toHaveLength(1);
    expect(captureC.querySelectorAll(".cv-preview-container")).toHaveLength(1);
  });

  it("never renders the page-break overlay on the capture copy", () => {
    const data = { ...createEmptyCVData(), template: "german-standard" as const };
    const { container: captureC } = render(
      <CVPreview data={data} id="cv-capture" scaled={false} />
    );
    // The overlay is the only absolute, pointer-events-none block carrying
    // the dashed break rules. It must never appear on the PDF capture copy.
    expect(captureC.querySelector('[class*="pointer-events-none"][class*="absolute"]')).toBeNull();
  });
});
