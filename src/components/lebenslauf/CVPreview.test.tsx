import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import CVPreview from "./CVPreview";
import { CvCaptureSheet } from "./CvSheet";
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

describe("CV preview / capture contract", () => {
  it.each(templates)("mounts the %s template in both the on-screen preview and the capture sheet", (template) => {
    const data = { ...createEmptyCVData(), template };

    const { container: previewC } = render(<CVPreview data={data} />);
    expect(previewC.querySelector("#cv-preview")).toBeTruthy();

    const { container: captureC } = render(<CvCaptureSheet data={data} />);
    expect(captureC.querySelector("#cv-capture")).toBeTruthy();
  });

  it("renders the same template body in both copies (no silent divergence)", () => {
    const data = { ...createEmptyCVData(), template: "german-standard" as const };
    const { container: previewC } = render(<CVPreview data={data} />);
    const { container: captureC } = render(<CvCaptureSheet data={data} />);
    // The template-specific sheet root (cv-preview-container) must be present
    // in both — guards against a future template being added to one copy but
    // not the other (the PDF would silently render the wrong template).
    expect(previewC.querySelectorAll(".cv-preview-container")).toHaveLength(1);
    expect(captureC.querySelectorAll(".cv-preview-container")).toHaveLength(1);
  });

  it("never renders the page-break overlay on the capture sheet", () => {
    const data = { ...createEmptyCVData(), template: "german-standard" as const };
    const { container: captureC } = render(<CvCaptureSheet data={data} />);
    // The overlay is screen-only; it must never appear on the PDF capture
    // sheet (it would be rasterized into the PDF). Asserted via the stable
    // data attribute, not Tailwind class substrings.
    expect(captureC.querySelector("[data-page-break-overlay]")).toBeNull();
  });

  // The form collects projects[].url; every template must render it so the
  // field is not silently lost in preview and PDF.
  it.each(templates)("renders the project URL on the %s capture sheet", (template) => {
    const data = {
      ...createEmptyCVData(),
      template,
      projects: [{ id: "p1", name: "Portfolio", url: "https://example.test/x", bullets: [] }],
    };
    const { container: captureC } = render(<CvCaptureSheet data={data} />);
    expect(captureC.textContent).toContain("https://example.test/x");
  });
});
