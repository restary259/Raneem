import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned primary/secondary actions. */
  actions?: React.ReactNode;
  /** Optional row rendered under the title (tabs, filters, toolbar). */
  children?: React.ReactNode;
  /** Sticks to the top of the scroll container on desktop. */
  sticky?: boolean;
  className?: string;
}

/**
 * The one page header used by every dashboard page.
 *
 * Presentational only — it owns spacing, the title/subtitle hierarchy and the
 * action slot so pages stop hand-rolling their own header markup (which is what
 * caused the inconsistent top spacing across roles).
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
  children,
  sticky = false,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-4 space-y-3",
        sticky &&
          "md:sticky md:top-0 md:z-20 md:-mx-4 md:bg-background/85 md:px-4 md:py-3 md:backdrop-blur md:supports-[backdrop-filter]:bg-background/70",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
