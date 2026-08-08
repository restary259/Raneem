import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { PipelineStatus } from "@/lib/caseStatus";
import { cn } from "@/lib/utils";

interface Props {
  statuses: PipelineStatus[];
  currentKey: string;
}

/**
 * Compact dot-and-line rail: filled dots for completed stages, a ringed dot for
 * the current stage, muted dots for what is still ahead.
 */
export default function CaseProgressRail({ statuses, currentKey }: Props) {
  const { t } = useTranslation("dashboard");
  const stages = statuses.filter((s) => s.is_active && !["forgotten", "cancelled"].includes(s.key));
  const currentIndex = stages.findIndex((s) => s.key === currentKey);

  return (
    <div
      className="flex items-center min-w-0 flex-1"
      role="img"
      aria-label={t("case.progressLabel", "Case progress")}
    >
      {stages.map((stage, idx) => {
        const done = currentIndex >= 0 && idx < currentIndex;
        const current = idx === currentIndex;
        return (
          <React.Fragment key={stage.key}>
            {idx > 0 && (
              <div
                className={cn("h-px flex-1 min-w-[6px]", done || current ? "bg-primary" : "bg-border")}
              />
            )}
            <div
              title={t(`case.status.${stage.key}`, stage.label_en)}
              className={cn(
                "shrink-0 rounded-full flex items-center justify-center",
                done && "h-2.5 w-2.5 bg-primary",
                current && "h-3.5 w-3.5 border-2 border-primary bg-background",
                !done && !current && "h-2.5 w-2.5 bg-muted-foreground/40",
              )}
            >
              {done && <Check className="h-2 w-2 text-primary-foreground" aria-hidden />}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
