import React from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * One look for empty / loading / error across every role. Pages previously
 * rolled their own, which is why the same situation looked different in the
 * admin, team and student dashboards.
 */

interface EmptyStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <Icon className="mb-3 h-9 w-9 text-muted-foreground/40" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface LoadingStateProps {
  /** Number of skeleton rows/cards — match the real layout to avoid layout shift. */
  rows?: number;
  /**
   * Shape of the skeleton so it reserves the same space the real content will:
   * - `rows`  — stacked list rows (default)
   * - `table` — header strip + tighter rows
   * - `cards` — responsive card grid
   * - `kpi`   — compact stat tiles
   */
  variant?: "rows" | "table" | "cards" | "kpi";
  /** Render a compact inline spinner instead of skeletons. */
  inline?: boolean;
  label?: string;
  className?: string;
}

export function LoadingState({
  rows = 3,
  variant = "rows",
  inline = false,
  label,
  className,
}: LoadingStateProps) {
  if (inline) {
    return (
      <div
        className={cn("flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground", className)}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {label && <span>{label}</span>}
      </div>
    );
  }

  const a11y = {
    role: "status" as const,
    "aria-live": "polite" as const,
    "aria-busy": true,
  };

  if (variant === "kpi") {
    return (
      <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)} {...a11y}>
        <span className="sr-only">{label ?? "Loading"}</span>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="mt-3 h-6 w-16 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)} {...a11y}>
        <span className="sr-only">{label ?? "Loading"}</span>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/2 rounded" />
                <Skeleton className="h-3 w-1/3 rounded" />
              </div>
            </div>
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={cn("overflow-hidden rounded-xl border border-border", className)} {...a11y}>
        <span className="sr-only">{label ?? "Loading"}</span>
        <div className="flex items-center gap-4 border-b border-border bg-muted/40 px-4 py-3">
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="ms-auto h-3 w-16 rounded" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 w-1/3 rounded" />
            <Skeleton className="hidden h-3 w-1/5 rounded sm:block" />
            <Skeleton className="ms-auto h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)} {...a11y}>
      <span className="sr-only">{label ?? "Loading"}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}


interface ErrorStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({ title, description, onRetry, retryLabel, className }: ErrorStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}
      role="alert"
    >
      <AlertTriangle className="mb-3 h-8 w-8 text-destructive/70" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          {retryLabel ?? "Retry"}
        </Button>
      )}
    </div>
  );
}
