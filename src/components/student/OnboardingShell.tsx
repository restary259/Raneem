import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Reusable visual shell for the student onboarding wizard. Owns ONLY the
 * layout: the header (back + step counter), the progress indicator, the
 * section-context row (current section + what's next), the content slot, and
 * the footer (Back + Continue + a "steps remaining" note). All business logic
 * (state, validation, persistence, step order) stays in the caller; this
 * component is presentational.
 *
 * Styling follows the student dashboard design system exactly: shadcn Card /
 * Button / Progress primitives, semantic tokens (background, card, border,
 * primary, muted-foreground) and the dashboard typography scale — so the
 * wizard reads as the same product as the rest of the student dashboard.
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
  // last. Never faked.
  const progressPct = totalSteps > 1 ? (stepIndex / (totalSteps - 1)) * 100 : 0;
  const reduced = prefersReducedMotion();

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col p-4 sm:p-6">
      {/* ── Header: back + step counter ─────────────────────────────────── */}
      <header className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => onBack?.()}
          disabled={!onBack || disabled}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <div className="text-xs text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-foreground">{stepIndex + 1}</span>
          <span> / {totalSteps}</span>
        </div>
      </header>

      {/* ── Progress: origin → bar → destination ─────────────────────────── */}
      <div className="mt-4 flex items-center gap-3">
        <span className="shrink-0 text-xs font-medium text-foreground">{journeyStart}</span>
        <Progress
          value={progressPct}
          className="h-1.5 flex-1"
          aria-label={`${progressPct.toFixed(0)}%`}
        />
        <span className="shrink-0 text-xs text-muted-foreground">{journeyEnd}</span>
      </div>

      {/* ── Section context: current section + what's next ───────────────── */}
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-foreground">{section}</span>
        {nextSection && (
          <span className="truncate text-xs text-muted-foreground">{nextSection}</span>
        )}
      </div>

      {/* ── Step content: headline + explanation + field(s) ─────────────── */}
      <Card className="mt-4 flex flex-1 flex-col">
        <CardContent
          key={stepIndex}
          className={cn(
            "flex flex-1 flex-col p-4 sm:p-6",
            !reduced && "animate-[fade-in_0.25s_ease-out]",
          )}
        >
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
          <div className="mt-6 flex-1">{children}</div>
        </CardContent>
      </Card>

      {/* ── Footer: Back + Continue ──────────────────────────────────────── */}
      <div className="sticky bottom-0 z-40 -mx-4 mt-4 border-t border-border bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0">
        {footer}
      </div>
    </div>
  );
}

export default OnboardingShell;
