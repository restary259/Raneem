import React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface SegmentItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
}

interface SegmentedTabsProps {
  items: SegmentItem[];
  className?: string;
}

/**
 * Scrollable segmented control for page-level tabs. Must be rendered inside a
 * shadcn `<Tabs>` so keyboard roving focus and aria wiring come for free.
 *
 * Fit-aware centering: the row centers when its natural width fits the viewport
 * and only falls back to left-aligned horizontal scroll when it overflows.
 * `mx-auto` distributes the slack equally when content is narrower than the
 * container; when content is wider, the auto margins collapse to 0 and the row
 * scrolls left-aligned (so the first tab is always reachable at scroll 0).
 * The scrollbar is hidden in all cases.
 */
export default function SegmentedTabs({ items, className }: SegmentedTabsProps) {
  return (
    <div className="overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsList className={cn("flex h-10 w-fit min-w-full mx-auto justify-center gap-2", className)}>
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className="shrink-0 gap-1.5 px-4 py-2 text-sm data-[state=active]:shadow-sm"
          >
            {item.icon && <item.icon className="h-4 w-4" aria-hidden />}
            {item.label}
            {typeof item.count === "number" && (
              <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
                {item.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
