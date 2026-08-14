import React from "react";
import { cn } from "@/lib/utils";

export interface KpiItem {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small caption under the value (delta, hint, secondary unit). */
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional tone classes from `statusTokens` (text colour for the value). */
  tone?: string;
  onClick?: () => void;
}

interface KpiRowProps {
  items: KpiItem[];
  /** Columns on desktop. Mobile is always 2-up. */
  columns?: 2 | 3 | 4;
  className?: string;
}

const COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * Compact stat tiles. Replaces the stacked full-width KPI cards that were the
 * main cause of excessive vertical scrolling on the dashboard homes.
 */
export default function KpiRow({ items, columns = 4, className }: KpiRowProps) {
  if (!items.length) return null;
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:gap-3", COLS[columns], className)}>
      {items.map((item) => {
        const Tag = item.onClick ? "button" : "div";
        return (
          <Tag
            key={item.key}
            type={item.onClick ? "button" : undefined}
            onClick={item.onClick}
            className={cn(
              "rounded-lg border border-border/70 bg-card p-3 text-start transition-colors",
              item.onClick &&
                "hover:border-border hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.icon && <item.icon className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{item.label}</span>
            </div>
            <p
              className={cn(
                "mt-1 truncate text-lg font-semibold tabular-nums text-foreground sm:text-xl",
                item.tone,
              )}
            >
              {item.value}
            </p>
            {item.hint && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.hint}</p>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
