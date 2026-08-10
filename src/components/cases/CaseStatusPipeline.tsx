import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CaseStatusPipelineProps {
  currentStatus: string;
  stages: string[];
  /** Translation key per stage. Missing entries fall back to `case.status.<stage>`. */
  labels?: Record<string, string>;
}

const humanise = (stage: string) => stage.replace(/_/g, " ");

/**
 * Numbered stepper across the case pipeline. Statuses outside `stages`
 * (cancelled, forgotten, legacy values) render as "not started" rather than
 * silently marking every step as upcoming.
 */
export default function CaseStatusPipeline({ currentStatus, stages, labels }: CaseStatusPipelineProps) {
  const { t } = useTranslation("dashboard");
  const currentIndex = stages.indexOf(currentStatus);
  const onPipeline = currentIndex >= 0;

  const label = (stage: string) =>
    t(labels?.[stage] ?? `case.status.${stage}`, { defaultValue: humanise(stage) });

  return (
    <div className="space-y-2">
      <ol
        className="flex items-center gap-1 overflow-x-auto pb-2"
        aria-label={t("case.progressLabel", { defaultValue: "Case progress" })}
      >
        {stages.map((stage, idx) => {
          const isDone = onPipeline && idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = !isDone && !isCurrent;

          return (
            <React.Fragment key={`${stage}-${idx}`}>
              {idx > 0 && (
                <li aria-hidden className={cn("h-0.5 w-4 shrink-0", isDone ? "bg-primary" : "bg-border")} />
              )}
              <li
                aria-current={isCurrent ? "step" : undefined}
                className={cn("flex shrink-0 flex-col items-center gap-1", isFuture && "opacity-60")}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold",
                    isDone && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-background text-primary ring-2 ring-primary/30",
                    isFuture && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" aria-hidden /> : idx + 1}
                </div>
                <span className="sr-only sm:not-sr-only sm:block sm:max-w-[50px] sm:text-center sm:text-[10px] sm:font-semibold sm:text-muted-foreground">
                  {label(stage)}
                </span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>

      <p className="px-1 text-xs text-muted-foreground">
        {onPipeline
          ? `${label(currentStatus)} (${currentIndex + 1}/${stages.length})`
          : t("case.pipeline.offPipeline", {
              status: label(currentStatus),
              defaultValue: "{{status}} — outside the standard pipeline",
            })}
      </p>
    </div>
  );
}
