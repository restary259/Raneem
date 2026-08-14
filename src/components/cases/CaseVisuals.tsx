import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineStatus } from "@/lib/caseStatus";
import { toneClasses, toneForStatus, type StatusTone } from "@/lib/statusTokens";

/* ── Status chip ─────────────────────────────────────────────────────── */

export function CaseStatusChip({
  status,
  label,
  className,
  size = "sm",
}: {
  status: string;
  /** Optional pre-resolved label; falls back to the `case.status.*` key. */
  label?: string;
  className?: string;
  size?: "sm" | "xs";
}) {
  const { t } = useTranslation("dashboard");
  const tone = toneForStatus(status);
  const tc = toneClasses(tone);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        tc.chip,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tc.dot)} aria-hidden />
      {label ?? t(`case.status.${status}`, status.replace(/_/g, " "))}
    </span>
  );
}

/* ── Status line (sleek segmented progress) ──────────────────────────── */

interface StatusLineProps {
  statuses: PipelineStatus[];
  currentKey: string;
  /** Show stage labels under the segments (desktop only). */
  showLabels?: boolean;
  className?: string;
}

/**
 * A thin segmented rail: completed segments are filled with the tone of the
 * stage they represent, the current segment pulses subtly, upcoming segments
 * stay muted. Meaning is carried by position + label, never by colour alone.
 */
export function StatusLine({
  statuses,
  currentKey,
  showLabels = false,
  className,
}: StatusLineProps) {
  const { t } = useTranslation("dashboard");
  const stages = statuses.filter(
    (s) => s.is_active && !["forgotten", "cancelled"].includes(s.key),
  );
  const currentIndex = stages.findIndex((s) => s.key === currentKey);
  const label = (s: PipelineStatus) => t(`case.status.${s.key}`, s.label_en ?? s.key);

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className="flex items-center gap-1"
        role="img"
        aria-label={`${t("case.progressLabel", "Case progress")} — ${
          currentIndex >= 0 ? label(stages[currentIndex]) : currentKey
        }`}
      >
        {stages.map((stage, idx) => {
          const done = currentIndex >= 0 && idx < currentIndex;
          const current = idx === currentIndex;
          const tc = toneClasses(done || current ? toneForStatus(stage.key) : "neutral");
          return (
            <span
              key={stage.key}
              title={label(stage)}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                done || current ? tc.fill : "bg-border",
                current && "ring-2 ring-offset-1 ring-offset-background ring-[hsl(var(--status-" +
                  "" +
                  "))]",
              )}
            />
          );
        })}
      </div>
      {showLabels && (
        <div className="mt-1.5 hidden justify-between gap-1 sm:flex">
          {stages.map((stage, idx) => (
            <span
              key={stage.key}
              className={cn(
                "flex-1 truncate text-center text-[10px]",
                idx === currentIndex
                  ? cn("font-medium", toneClasses(toneForStatus(stage.key)).text)
                  : "text-muted-foreground/70",
              )}
            >
              {label(stage)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Stepper dots (richer, for detail headers) ───────────────────────── */

export function StatusSteps({
  statuses,
  currentKey,
  className,
}: {
  statuses: PipelineStatus[];
  currentKey: string;
  className?: string;
}) {
  const { t } = useTranslation("dashboard");
  const stages = statuses.filter(
    (s) => s.is_active && !["forgotten", "cancelled"].includes(s.key),
  );
  const currentIndex = stages.findIndex((s) => s.key === currentKey);

  return (
    <div className={cn("flex min-w-0 items-center", className)}>
      {stages.map((stage, idx) => {
        const done = currentIndex >= 0 && idx < currentIndex;
        const current = idx === currentIndex;
        const tone: StatusTone = done || current ? toneForStatus(stage.key) : "neutral";
        const tc = toneClasses(tone);
        return (
          <React.Fragment key={stage.key}>
            {idx > 0 && (
              <span
                className={cn(
                  "h-px min-w-[8px] flex-1",
                  done || current ? tc.fill : "bg-border",
                )}
              />
            )}
            <span
              title={t(`case.status.${stage.key}`, stage.label_en ?? stage.key)}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full transition-all",
                done && cn("h-2.5 w-2.5", tc.fill),
                current &&
                  cn("h-3.5 w-3.5 border-2 bg-background", tc.text, "border-current"),
                !done && !current && "h-2.5 w-2.5 bg-border",
              )}
            >
              {done && <Check className="h-2 w-2 text-background" aria-hidden />}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Case card ───────────────────────────────────────────────────────── */

export function CaseCard({
  status,
  onClick,
  className,
  children,
}: {
  status: string;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const tc = toneClasses(toneForStatus(status));
  const interactive = Boolean(onClick);
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card p-3 shadow-surface transition-all",
        interactive &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-surface-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 start-0 w-1", tc.fill)}
      />
      <div className="ps-2">{children}</div>
    </div>
  );
}
