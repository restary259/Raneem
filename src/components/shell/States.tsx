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
  /** Number of skeleton rows — match the real layout to avoid layout shift. */
  rows?: number;
  /** Render a compact inline spinner instead of skeleton rows. */
  inline?: boolean;
  label?: string;
  className?: string;
}

export function LoadingState({ rows = 3, inline = false, label, className }: LoadingStateProps) {
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
  return (
    <div className={cn("space-y-2", className)} role="status" aria-live="polite" aria-busy="true">
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
