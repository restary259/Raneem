import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatCompact,
  formatCount,
  type PerformanceChartRow,
} from "@/lib/googlePerformance";
import type { GooglePerformanceMetric } from "@/types/googleBusiness";

export type PerformanceSeriesConfig = {
  metric: GooglePerformanceMetric;
  label: string;
  color: string;
};

type Props = {
  rows: PerformanceChartRow[];
  series: PerformanceSeriesConfig[];
  locale: string;
  isRtl: boolean;
  height?: number;
  /** Screen-reader summary generated from the real data. */
  ariaLabel: string;
  emptyLabel: string;
};

function formatAxisDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const tag =
    locale === "ar" ? "ar-u-nu-latn" : locale === "he" ? "he" : "en-US";
  return new Intl.DateTimeFormat(tag, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * A single-purpose trend chart.
 *
 * Time still reads left-to-right even in an RTL interface: reversing a
 * chronological axis would change what the data means. `connectNulls={false}`
 * keeps a missing day a gap rather than drawing a line through it.
 */
export default function PerformanceTrendChart({
  rows,
  series,
  locale,
  isRtl,
  height = 240,
  ariaLabel,
  emptyLabel,
}: Props) {
  if (rows.length === 0 || series.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div dir="ltr" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={rows}
          margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => formatAxisDate(value, locale)}
            tick={{ fontSize: 11 }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            width={isRtl ? 56 : 44}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => formatCompact(value, locale)}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatCount(value, locale),
              name,
            ]}
            labelFormatter={(value: string) => formatAxisDate(value, locale)}
            contentStyle={{ direction: isRtl ? "rtl" : "ltr", fontSize: 12 }}
          />
          {series.map((s) => (
            <Line
              key={s.metric}
              type="monotone"
              dataKey={s.metric}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={rows.length <= 1}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
