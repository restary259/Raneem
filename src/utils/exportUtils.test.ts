/* eslint-disable @typescript-eslint/no-explicit-any -- loose types for untyped mock surfaces (supabase query builders, browser globals) */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { docInstances, autoTableCalls, state, MockDoc } = vi.hoisted(() => {
  const docInstances: any[] = [];
  const autoTableCalls: Array<{ doc: any; options: any }> = [];
  const state = {
    fonts: { arabic: true, hebrew: true } as Record<string, boolean>,
  };

  class MockDoc {
    orientation: string;
    internal = { pageSize: { width: 210, height: 297 } };
    setFont = vi.fn();
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    text = vi.fn();
    save = vi.fn();
    getCurrentPageInfo = vi.fn().mockReturnValue({ pageNumber: 1 });
    constructor(options: { orientation: string }) {
      this.orientation = options.orientation;
      docInstances.push(this);
    }
  }

  return { docInstances, autoTableCalls, state, MockDoc };
});

vi.mock("jspdf", () => ({ default: MockDoc }));

vi.mock("jspdf-autotable", () => ({
  default: (doc: any, options: any) => {
    autoTableCalls.push({ doc, options });
  },
}));

vi.mock("./pdfFonts", () => ({
  registerPdfFonts: vi.fn(async () => state.fonts),
  shapeForPdf: (s: string) => s,
  // Mirrors the real fontForText: returns the fallback when the face is
  // unregistered, which is exactly what the rtlFontMissing check relies on.
  fontForText: (
    text: string,
    fonts: Record<string, boolean>,
    fallback = "helvetica",
  ) => {
    const arabic = /[\u0600-\u06FF]/.test(text);
    const hebrew = /[\u0590-\u05FF]/.test(text);
    if (!arabic && !hebrew) return "helvetica";
    if (arabic) return fonts.arabic ? "NotoNaskhArabic" : fallback;
    return fonts.hebrew ? "NotoSansHebrew" : fallback;
  },
  hasRtl: (text: string) =>
    /[\u0590-\u05FF]/.test(text) || /[\u0600-\u06FF]/.test(text),
}));

import { exportPDF, preparePdfTableData } from "./exportUtils";

beforeEach(() => {
  docInstances.length = 0;
  autoTableCalls.length = 0;
  state.fonts = { arabic: true, hebrew: true };
});

describe("preparePdfTableData", () => {
  it("returns the data unchanged for LTR", () => {
    const result = preparePdfTableData(["A", "B"], [[1, 2]], false);
    expect(result.headers).toEqual(["A", "B"]);
    expect(result.rows).toEqual([[1, 2]]);
  });

  it("reverses headers and each row for RTL", () => {
    const result = preparePdfTableData(["A", "B", "C"], [[1, 2, 3]], true);
    expect(result.headers).toEqual(["C", "B", "A"]);
    expect(result.rows).toEqual([[3, 2, 1]]);
  });

  it("does not mutate the caller's arrays", () => {
    const headers = ["A", "B"];
    const rows = [[1, 2]];
    preparePdfTableData(headers, rows, true);
    expect(headers).toEqual(["A", "B"]);
    expect(rows).toEqual([[1, 2]]);
  });
});

describe("exportPDF", () => {
  it("saves the document with the requested file name", async () => {
    const result = await exportPDF({
      headers: ["Name", "City"],
      rows: [["Layla", "Haifa"]],
      fileName: "report",
    });
    expect(result).toEqual({ rtlFontMissing: false });
    expect(docInstances[0].save).toHaveBeenCalledWith("report.pdf");
  });

  it("uses portrait for narrow tables and landscape for wide ones", async () => {
    await exportPDF({ headers: ["A", "B"], rows: [], fileName: "narrow" });
    expect(docInstances[0].orientation).toBe("portrait");

    await exportPDF({
      headers: ["A", "B", "C", "D", "E", "F", "G", "H"],
      rows: [],
      fileName: "wide",
    });
    expect(docInstances[1].orientation).toBe("landscape");
  });

  it("appends a separator and the summary rows at the bottom", async () => {
    await exportPDF({
      headers: ["Item", "Amount"],
      rows: [["A", 10]],
      summaryRows: [["Total", 10]],
      fileName: "summary",
    });
    const { options } = autoTableCalls[0];
    expect(options.body).toHaveLength(3);
    expect(options.body[1]).toEqual(["", ""]);
    expect(options.body[2]).toEqual(["Total", "10"]);
  });

  it("draws the title when provided", async () => {
    await exportPDF({
      headers: ["A"],
      rows: [],
      fileName: "titled",
      title: "Quarterly report",
    });
    const doc = docInstances[0];
    expect(doc.text).toHaveBeenCalledWith("Quarterly report", 14, 20, {
      align: "left",
    });
    expect(autoTableCalls[0].options.startY).toBe(28);
  });

  it("right-aligns the title for RTL exports", async () => {
    await exportPDF({
      headers: ["A"],
      rows: [],
      fileName: "rtl",
      title: "تقرير",
      rtl: true,
    });
    const call = docInstances[0].text.mock.calls[0];
    expect(call[0]).toBe("تقرير");
    expect(call[3]).toEqual({ align: "right" });
  });

  it("flags a missing RTL font when RTL text cannot be rendered", async () => {
    state.fonts = { arabic: false, hebrew: false };
    const result = await exportPDF({
      headers: ["الاسم"],
      rows: [],
      fileName: "missing-font",
    });
    expect(result.rtlFontMissing).toBe(true);
  });

  it("does not flag a missing font when only Latin text is present", async () => {
    state.fonts = { arabic: false, hebrew: false };
    const result = await exportPDF({
      headers: ["Name"],
      rows: [["Layla"]],
      fileName: "latin",
    });
    expect(result.rtlFontMissing).toBe(false);
  });

  it("selects an RTL font and right alignment per cell during table parsing", async () => {
    await exportPDF({ headers: ["A"], rows: [], fileName: "cells" });
    const { didParseCell } = autoTableCalls[0].options;
    const cell = { text: ["مرحبا"], styles: {} as Record<string, unknown> };
    didParseCell({ cell });
    expect(cell.styles.font).toBe("NotoNaskhArabic");
    expect(cell.styles.halign).toBe("right");
  });

  it("keeps helvetica for a Latin cell", async () => {
    await exportPDF({ headers: ["A"], rows: [], fileName: "cells-latin" });
    const { didParseCell } = autoTableCalls[0].options;
    const cell = { text: "hello", styles: {} as Record<string, unknown> };
    didParseCell({ cell });
    expect(cell.styles.font).toBeUndefined();
  });
});
