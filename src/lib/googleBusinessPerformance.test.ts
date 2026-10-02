import { describe, expect, it } from "vitest";
import {
  multiDailyMetricsPath,
  normalizeMultiDailyMetrics,
  normalizeSearchKeywordCounts,
  searchKeywordsPath,
} from "./googleBusinessGateway";
import {
  addDaysIso,
  daysBetweenInclusive,
  expectedDataThrough,
  formatInsightsValue,
  formatMonth,
  googlePerformanceHealth,
  groupSeriesByDate,
  keywordSyncMonths,
  monthsInRange,
  officeToday,
  percentChange,
  previousMonths,
  previousPeriod,
  resolveDateRange,
  resolveMonthRange,
} from "./googlePerformance";

describe("normalizeMultiDailyMetrics", () => {
  it("flattens the nested multi-metric response into (metric, date) rows", () => {
    const rows = normalizeMultiDailyMetrics({
      multiDailyMetricTimeSeries: [
        {
          dailyMetricTimeSeries: [
            {
              dailyMetric: "WEBSITE_CLICKS",
              timeSeries: {
                datedValues: [
                  { date: { year: 2026, month: 9, day: 30 }, value: "17" },
                  { date: { year: 2026, month: 9, day: 29 }, value: "4" },
                ],
              },
            },
            {
              dailyMetric: "CALL_CLICKS",
              timeSeries: {
                datedValues: [{ date: { year: 2026, month: 9, day: 30 } }],
              },
            },
          ],
        },
      ],
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      metric: "WEBSITE_CLICKS",
      metric_date: "2026-09-30",
      metric_value: 17,
      data_state: "VALUE",
    });
    // Google omits `value` when the metric is zero; that is a measured 0, not a gap.
    expect(rows[2]).toMatchObject({
      metric: "CALL_CLICKS",
      metric_date: "2026-09-30",
      metric_value: 0,
      data_state: "ZERO",
    });
  });

  it("ignores metrics DARB does not store and malformed datapoints", () => {
    const rows = normalizeMultiDailyMetrics({
      multiDailyMetricTimeSeries: [
        {
          dailyMetricTimeSeries: [
            {
              dailyMetric: "BUSINESS_FOOD_ORDERS",
              timeSeries: {
                datedValues: [
                  { date: { year: 2026, month: 9, day: 1 }, value: "3" },
                ],
              },
            },
            {
              dailyMetric: "WEBSITE_CLICKS",
              timeSeries: {
                datedValues: [
                  {
                    date: { year: 2026, month: 9, day: 1 },
                    value: "not-a-number",
                  },
                  { date: {}, value: "5" },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(rows).toEqual([]);
  });
});

describe("normalizeSearchKeywordCounts", () => {
  it("keeps a threshold a threshold and an exact value exact", () => {
    const rows = normalizeSearchKeywordCounts({
      searchKeywordsCounts: [
        { searchKeyword: "study in germany", insightsValue: { value: "820" } },
        { searchKeyword: "study abroad", insightsValue: { threshold: "15" } },
      ],
    });
    expect(rows).toEqual([
      {
        search_keyword: "study in germany",
        insights_value: 820,
        insights_value_type: "VALUE",
        month: null,
      },
      {
        search_keyword: "study abroad",
        insights_value: 15,
        insights_value_type: "THRESHOLD",
        month: null,
      },
    ]);
  });

  it("drops empty keywords and empty insights", () => {
    const rows = normalizeSearchKeywordCounts({
      searchKeywordsCounts: [
        { searchKeyword: "   ", insightsValue: { value: "3" } },
        { searchKeyword: "darb", insightsValue: {} },
      ],
    });
    expect(rows).toEqual([]);
  });
});

describe("performance paths", () => {
  it("builds a multi-metric daily range request", () => {
    const path = multiDailyMetricsPath(
      "123",
      ["WEBSITE_CLICKS", "CALL_CLICKS"],
      "2026-09-01",
      "2026-09-30",
    );
    expect(path).toContain(
      "/performance/v1/locations/123:fetchMultiDailyMetricsTimeSeries?",
    );
    expect(path).toContain("dailyMetrics=WEBSITE_CLICKS");
    expect(path).toContain("dailyMetrics=CALL_CLICKS");
    expect(path).toContain("dailyRange.startDate.month=9");
    expect(path).toContain("dailyRange.endDate.day=30");
  });

  it("caps the keyword page size at Google's limit", () => {
    const path = searchKeywordsPath(
      "123",
      "2026-06-01",
      "2026-09-01",
      undefined,
      5000,
    );
    expect(path).toContain("pageSize=100");
    expect(path).toContain("monthlyRange.endMonth.month=9");
  });
});

describe("date helpers (office timezone)", () => {
  it("resolves a preset against the office timezone, not the server clock", () => {
    const now = new Date("2026-10-02T02:00:00Z");
    // Berlin is UTC+2 in October, so the office date is already Oct 2.
    const range = resolveDateRange("30d", "Europe/Berlin", now);
    expect(range.endDate).toBe("2026-10-02");
    expect(range.startDate).toBe("2026-09-03");
    expect(daysBetweenInclusive(range.startDate, range.endDate)).toBe(30);

    // In UTC the same instant is still Oct 2 as well; pick a time that differs.
    const edge = new Date("2026-10-01T23:30:00Z");
    expect(officeToday("Europe/Berlin", edge)).toBe("2026-10-02");
    expect(officeToday("UTC", edge)).toBe("2026-10-01");
  });

  it("computes the immediately preceding equal-length window", () => {
    const prev = previousPeriod({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });
    expect(prev).toEqual({ startDate: "2026-08-02", endDate: "2026-08-31" });
  });

  it("crosses month and year boundaries without drift", () => {
    expect(addDaysIso("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysIso("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDaysIso("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("resolves a rolling month range for keyword data", () => {
    const { startMonth, endMonth } = resolveMonthRange(
      6,
      "Europe/Berlin",
      new Date("2026-10-15T12:00:00Z"),
    );
    expect(endMonth).toBe("2026-10-01");
    expect(startMonth).toBe("2026-05-01");
  });

  it("lists each month in a range so keywords can be fetched per month", () => {
    // Google aggregates over the whole monthlyRange, so the sync must request
    // one month at a time and store that month's own value.
    expect(monthsInRange("2026-08-01", "2026-10-01")).toEqual([
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
    expect(monthsInRange("2026-11-01", "2027-02-01")).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
    ]);
  });

  it("lists the months immediately before a month, newest first", () => {
    expect(previousMonths("2026-10-01", 5)).toEqual([
      "2026-09-01",
      "2026-08-01",
      "2026-07-01",
      "2026-06-01",
      "2026-05-01",
    ]);
    expect(previousMonths("2026-01-01", 2)).toEqual([
      "2025-12-01",
      "2025-11-01",
    ]);
  });

  it("builds the sync's per-month fetch list, current month first", () => {
    expect(keywordSyncMonths("2026-10-01", 2)).toEqual([
      "2026-10-01",
      "2026-09-01",
      "2026-08-01",
    ]);
  });

  it("labels a keyword month for display", () => {
    expect(formatMonth("2026-09-01", "en")).toMatch(/September 2026/);
    expect(formatMonth(null, "en")).toBe("—");
  });

  it("treats yesterday as the newest data Google could have reported", () => {
    expect(expectedDataThrough("UTC", new Date("2026-10-02T12:00:00Z"))).toBe(
      "2026-10-01",
    );
  });
});

describe("chart data model", () => {
  it("groups series by date and leaves missing days as gaps", () => {
    const rows = groupSeriesByDate([
      {
        metric: "WEBSITE_CLICKS",
        metric_date: "2026-09-01",
        metric_value: 3,
        data_state: "VALUE",
      },
      {
        metric: "CALL_CLICKS",
        metric_date: "2026-09-01",
        metric_value: 1,
        data_state: "VALUE",
      },
      {
        metric: "WEBSITE_CLICKS",
        metric_date: "2026-09-03",
        metric_value: 5,
        data_state: "VALUE",
      },
    ]);
    expect(rows).toEqual([
      { date: "2026-09-01", WEBSITE_CLICKS: 3, CALL_CLICKS: 1 },
      { date: "2026-09-03", WEBSITE_CLICKS: 5 },
    ]);
    // 2026-09-02 is absent, so the chart draws a gap rather than a zero.
    expect(rows[1].CALL_CLICKS).toBeUndefined();
  });
});

describe("percentChange", () => {
  it("returns null when there is no baseline instead of infinite growth", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(10, Number.NaN)).toBeNull();
  });
  it("computes a normal comparison", () => {
    expect(percentChange(423, 357)).toBeCloseTo(18.487, 3);
    expect(percentChange(87, 91)).toBeCloseTo(-4.396, 3);
  });
});

describe("formatInsightsValue", () => {
  it("renders a threshold with a less-than sign", () => {
    expect(formatInsightsValue(820, "VALUE", "en")).toBe("820");
    expect(formatInsightsValue(15, "THRESHOLD", "en")).toBe("<15");
  });
});

describe("googlePerformanceHealth", () => {
  const base = {
    connection_status: "connected",
    mapping_status: "MAPPED",
    has_any_data: true,
    performance_sync_error_code: null,
    data_through: "2026-09-30",
  };
  it("reports healthy, stale, syncing and unavailable distinctly", () => {
    expect(googlePerformanceHealth(base, "2026-09-30")).toBe("Healthy");
    expect(
      googlePerformanceHealth(
        { ...base, data_through: "2026-09-20" },
        "2026-09-30",
      ),
    ).toBe("Stale");
    expect(
      googlePerformanceHealth(
        { ...base, performance_sync_error_code: "GOOGLE_PERFORMANCE_QUOTA" },
        "2026-09-30",
      ),
    ).toBe("Stale");
    expect(
      googlePerformanceHealth({ ...base, has_any_data: false }, "2026-09-30"),
    ).toBe("Syncing");
    expect(
      googlePerformanceHealth(
        { ...base, mapping_status: "UNMAPPED" },
        "2026-09-30",
      ),
    ).toBe("Unavailable");
    expect(googlePerformanceHealth(null, "2026-09-30")).toBe("Unavailable");
  });
});
