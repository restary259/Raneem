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
 * On mobile the row scrolls horizontally instead of wrapping — wrapped pills
 * were pushing real content below the fold.
 */
export default function SegmentedTabs({ items, className }: SegmentedTabsProps) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex sm:justify-center">
      <TabsList className={cn("inline-flex h-10 min-w-full justify-start gap-2 sm:w-fit sm:min-w-0 sm:justify-center", className)}>
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
