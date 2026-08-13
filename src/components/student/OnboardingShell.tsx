import React from "react";
import { ArrowLeft, ArrowRight, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Reusable visual shell for the student onboarding wizard. Owns ONLY the
 * layout: the header (back + step counter), the journey-progress indicator
 * (origin → track → plane marker at the real completion % → destination), the
 * section-context row (current section + what's next), the content slot, and
 * the footer (secondary Back + full-width Continue + a "steps remaining"
 * note). All business logic (state, validation, persistence, step order)
 * stays in the caller; this component is presentational.
 *
 * Uses semantic design tokens (bg-background, text-foreground, border-border,
 * bg-brand) so it renders correctly in both light and dark themes — the
 * reference's dark aesthetic is adapted, not copied.
 */

interface OnboardingShellProps {
  /** Zero-based index of the current task within the full task list. */
  stepIndex: number;
  /** Total number of tasks in the wizard. */
  totalSteps: number;
  /** Localized label of the logical section the current task belongs to. */
  section: string;
  /** Localized label of the next section, or null/empty when this is the last. */
  nextSection: string | null;
  /** Localized origin stamp (e.g. the student's starting point). */
  journeyStart: string;
  /** Localized destination stamp (e.g. "DE"). */
  journeyEnd: string;
  /** Large editorial headline / question for this step. */
  title: React.ReactNode;
  /** Short contextual explanation shown beneath the headline. Optional. */
  description?: React.ReactNode;
  /** The field(s) for the current step. */
  children: React.ReactNode;
  /** Footer controls: Back button + Continue button (and progress note). */
  footer: React.ReactNode;
  /** Back handler; when null the back button is hidden (first step). */
  onBack: (() => void) | null;
  disabled?: boolean;
}

/** True when the user has asked the OS to reduce motion. */
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function OnboardingShell({
  stepIndex,
  totalSteps,
  section,
  nextSection,
  journeyStart,
  journeyEnd,
  title,
  description,
  children,
  footer,
  onBack,
  disabled,
}: OnboardingShellProps) {
  // Actual progress the student has earned: 0% at the first step, ~100% at the
  // last. This is the real position of the plane marker — never faked.
  const progressPct = totalSteps > 1 ? (stepIndex / (totalSteps - 1)) * 100 : 0;
  const reduced = prefersReducedMotion();

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pt-6 sm:pt-8">
      {/* ── Header: back + step counter ─────────────────────────────────── */}
      <header className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => onBack?.()}
          disabled={!onBack || disabled}
          className="h-9 w-9 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <div
          className="font-mono text-[11px] tracking-wider text-muted-foreground"
          aria-live="polite"
        >
          <span className="font-semibold text-brand">
            {String(stepIndex + 1).padStart(2, "0")}
          </span>
          <span className="text-muted-foreground/60"> / {String(totalSteps).padStart(2, "0")}</span>
        </div>
      </header>

      {/* ── Journey progress: origin stamp → dashed track + plane → destination ─ */}
      <div className="mt-5 flex items-center gap-0" role="img" aria-label={`${progressPct.toFixed(0)}%`}>
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-brand bg-brand/10 font-mono text-[9.5px] font-semibold text-brand">
          {journeyStart}
        </span>
        <div className="relative mx-1.5 h-px flex-1">
          {/* dashed baseline */}
          <div
            className={cn(
              "absolute inset-0 h-px",
              "bg-[repeating-linear-gradient(to_right,hsl(var(--border))_0_4px,transparent_4px_8px)]",
            )}
          />
          {/* filled portion up to the current progress */}
          <div
            className="absolute inset-y-0 h-px bg-brand transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%`, insetInlineStart: 0 }}
          />
          {/* plane marker at the actual progress position */}
          <span
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-brand"
            style={{ insetInlineStart: `${progressPct}%` }}
          >
            <Plane
              className={cn("h-3.5 w-3.5 rotate-90", !reduced && "transition-transform duration-300")}
            />
          </span>
        </div>
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-border bg-transparent font-mono text-[9.5px] font-semibold text-muted-foreground/70">
          {journeyEnd}
        </span>
      </div>

      {/* ── Section context: current section + what's next ───────────────── */}
      <div className="mt-4 flex items-baseline justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-brand">
          {section}
        </span>
        {nextSection && (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground/60">
            {nextSection}
          </span>
        )}
      </div>

      {/* ── Step content: headline + explanation + field(s) ─────────────── */}
      <div
        key={stepIndex}
        className={cn(
          "mt-6 flex flex-1 flex-col",
          !reduced && "animate-[fade-in_0.25s_ease-out]",
        )}
      >
        <h1 className="text-[26px] font-semibold leading-[1.2] tracking-tight text-foreground sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2.5 max-w-[19rem] text-[13.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        <div className="mt-7 flex-1">{children}</div>
      </div>

      {/* ── Footer: Back (secondary) + Continue (brand, full-width) ──────── */}
      <div className="sticky bottom-0 z-40 -mx-4 border-t border-border/60 bg-gradient-to-t from-background via-background to-transparent px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:pb-6 sm:pt-0">
        {footer}
      </div>
    </div>
  );
}

export default OnboardingShell;
