import React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface SegmentItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional badge count shown by consumers. */
  count?: number;
}

interface SegmentedTabsProps {
  items: SegmentItem[];
  className?: string;
}

/**
 * Scrollable segmented control for page-level tabs. Must be rendered inside a
 * shadcn <Tabs> so keyboard roving focus and aria wiring come for free.
 *
 * Mobile-compact + fit-aware centering:
 * - On mobile (<sm): icons are hidden and padding/gaps are tighter so short
 *   tab rows (e.g. 3 finance tabs) fit a 375px viewport without scrolling.
 *   Icons reappear on sm+ where horizontal space is plentiful.
 * - The row centers when its natural width fits the viewport and only falls
 *   back to left-aligned horizontal scroll when it overflows. The tab list
 *   uses its natural width instead of stretching to the full container, so
 *   short tab groups stay visually centered. With overflow, auto margins
 *   collapse and the first tab remains reachable at scroll 0.
 */
export default function SegmentedTabs({ items, className }: SegmentedTabsProps) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: false, end: false });

  const measure = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setEdges({ start: max > 1 && pos > 1, end: max > 1 && pos < max - 1 });
  }, []);

  React.useEffect(() => {
    measure();
    const el = scrollerRef.current;
    if (!el) return;
    // Bring the active tab into view so it is never half-cut on small screens.
    const active = el.querySelector<HTMLElement>('[data-state="active"]');
    active?.scrollIntoView({ inline: "center", block: "nearest" });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, items]);

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={measure}
        className="overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <TabsList
          className={cn(
            "mx-auto flex h-10 w-max max-w-none justify-center gap-1 bg-transparent p-0 sm:gap-2",
            className,
          )}
        >
          {items.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="shrink-0 gap-1.5 px-2.5 py-2 text-sm sm:gap-1.5 sm:px-4 data-[state=active]:shadow-xs"
            >
              {item.icon && <item.icon className="hidden h-4 w-4 sm:block" aria-hidden />}
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {edges.start && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 start-0 w-6 bg-gradient-to-r from-background to-transparent rtl:bg-gradient-to-l"
        />
      )}
      {edges.end && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 end-0 w-6 bg-gradient-to-l from-background to-transparent rtl:bg-gradient-to-r"
        />
      )}
    </div>
  );
}
