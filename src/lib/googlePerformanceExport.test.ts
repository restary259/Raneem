import { describe, it, expect } from "vitest";
import {
  buildPerformanceExportRows,
  performanceExportFileName,
} from "./googlePerformanceExport";

const ctx = {
  officeName: "Berlin Office",
  googleLocationName: "DARB Berlin",
  metricLabel: (metric: string) => metric,
};

describe("buildPerformanceExportRows", () => {
  it("keeps a threshold keyword in its <N form", () => {
    const rows = buildPerformanceExportRows(
      [],
      [
        {
          id: "k1",
          month: "2026-09-01",
          search_keyword: "study abroad",
          insights_value: 15,
          insights_value_type: "THRESHOLD",
          total_count: 1,
        },
      ],
      ctx,
    );
    expect(rows[0].Value).toBe("<15");
  });

  it("keeps an exact keyword value as a number", () => {
    const rows = buildPerformanceExportRows(
      [],
      [
        {
          id: "k1",
          month: "2026-09-01",
          search_keyword: "study in germany",
          insights_value: 820,
          insights_value_type: "VALUE",
          total_count: 1,
        },
      ],
      ctx,
    );
    expect(rows[0].Value).toBe(820);
  });

  it("neutralizes formula injection in a keyword", () => {
    const rows = buildPerformanceExportRows(
      [],
      [
        {
          id: "k1",
          month: "2026-09-01",
          search_keyword: '=HYPERLINK("http://evil","x")',
          insights_value: 10,
          insights_value_type: "VALUE",
          total_count: 1,
        },
      ],
      ctx,
    );
    expect(String(rows[0]["Search Keyword"]).startsWith("'=")).toBe(true);
  });

  it("neutralizes formula injection in office and location names", () => {
    const rows = buildPerformanceExportRows(
      [],
      [
        {
          id: "k1",
          month: "2026-09-01",
          search_keyword: "ok",
          insights_value: 1,
          insights_value_type: "VALUE",
          total_count: 1,
        },
      ],
      {
        officeName: "+Berlin",
        googleLocationName: "@DARB",
        metricLabel: (m) => m,
      },
    );
    expect(String(rows[0].Office)).toBe("'+Berlin");
    expect(String(rows[0]["Google Location"])).toBe("'@DARB");
  });
});

describe("performanceExportFileName", () => {
  it("includes office and range", () => {
    expect(
      performanceExportFileName("Berlin", "2026-09-01", "2026-09-30"),
    ).toContain("2026-09-01");
  });
});
