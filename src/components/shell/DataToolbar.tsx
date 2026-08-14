import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterPill {
  value: string;
  label: React.ReactNode;
  count?: number;
  /** Extra classes for a destructive/attention pill. */
  className?: string;
}

interface DataToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterPill[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  /** Extra controls (view switch, export, sort). */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Search + filter pills + trailing controls. Extracted from the per-page
 * inline blocks so every list surface filters the same way and the pill row
 * scrolls horizontally on mobile instead of wrapping into four tall lines.
 */
export default function DataToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  activeFilter,
  onFilterChange,
  children,
  className,
}: DataToolbarProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {onSearchChange && (
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-10 ps-9"
            />
          </div>
        )}
        {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
      </div>

      {filters && filters.length > 0 && (
        <div
          className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label={searchPlaceholder}
        >
          {filters.map((f) => {
            const active = activeFilter === f.value;
            return (
              <Button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={active}
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => onFilterChange?.(f.value)}
                className={cn("h-9 shrink-0 snap-start text-xs", f.className)}
              >
                {f.label}
                {typeof f.count === "number" && (
                  <span
                    className={cn(
                      "ms-1.5 rounded-full px-1.5 text-[10px] tabular-nums",
                      active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {f.count}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
