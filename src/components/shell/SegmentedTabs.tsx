import React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface SegmentItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SegmentedTabsProps {
  items: SegmentItem[];
  className?: string;
}

/**
 * Scrollable segmented control for page-level tabs. Must be rendered inside a
 * shadcn `<Tabs>` so keyboard roving focus and aria wiring come for free.
 *
 * Mobile-compact + fit-aware centering:
 * - On mobile (<sm): icons are hidden and padding/gaps are tighter so short
 *   tab rows (e.g. 3 finance tabs) fit a 375px viewport without scrolling.
 *   Icons reappear on sm+ where horizontal space is plentiful.
 * - The row centers when its natural width fits the viewport and only falls
 *   back to left-aligned horizontal scroll when it overflows. `mx-auto`
 *   distributes slack equally when content is narrow; when content is wider
 *   the auto margins collapse to 0 and the row scrolls left-aligned (so the
 *   first tab is always reachable at scroll 0). The scrollbar is hidden.
 */
export default function SegmentedTabs({ items, className }: SegmentedTabsProps) {
  return (
    <div className="overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsList className={cn("flex h-10 w-fit min-w-full mx-auto justify-center gap-1 sm:gap-2", className)}>
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className="shrink-0 gap-1.5 px-2.5 py-2 text-sm sm:px-4 sm:gap-1.5 data-[state=active]:shadow-sm"
          >
            {item.icon && <item.icon className="hidden h-4 w-4 sm:block" aria-hidden />}
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
