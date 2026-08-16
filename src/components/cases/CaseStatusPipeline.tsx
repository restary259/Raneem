import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusTone, toneClasses, toneForStatus } from "@/lib/statusTokens";

/** Pipeline tone → the `--status-*` CSS var that supplies the neon glow color. */
const NEON_VAR_BY_TONE: Record<StatusTone, string> = {
  new: "var(--status-new)",
  contacted: "var(--status-contacted)",
  appointment: "var(--status-appointment)",
  profile: "var(--status-profile)",
  payment: "var(--status-payment)",
  submitted: "var(--status-submitted)",
  enrolled: "var(--status-enrolled)",
  danger: "var(--status-danger)",
  neutral: "var(--ring)",
};

interface CaseStatusPipelineProps {
  currentStatus: string;
  stages: string[];
  labels: Record<string, string>;
}

export default function CaseStatusPipeline({
  currentStatus,
  stages,
  labels,
}: CaseStatusPipelineProps) {
  const { t } = useTranslation("dashboard");
  const currentIndex = stages.indexOf(currentStatus);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((stage, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;
          const tone = toneForStatus(stage);

          return (
            <React.Fragment key={stage}>
              {idx > 0 && (
                <div
                  className={cn(
                    "h-0.5 w-4 shrink-0",
                    isDone ? toneClasses(toneForStatus(stages[idx - 1])).fill : "bg-border"
                  )}
                />
              )}
              <div
                className={cn(
                  "flex flex-col items-center gap-1 shrink-0",
                  isFuture && "opacity-40"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                    isDone ? cn(toneClasses(tone).chip, "border") : "",
                    isCurrent
                      ? cn(
                          toneClasses(tone).chip,
                          "border ring-2 ring-current/30 neon-stage",
                        )
                      : "",
                    isFuture ? "bg-muted border-border text-muted-foreground" : ""
                  )}
                  style={
                    isCurrent
                      ? ({ "--neon-color": NEON_VAR_BY_TONE[tone] } as React.CSSProperties)
                      : undefined
                  }
                >
                  {isDone ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground hidden sm:block max-w-[50px] text-center">
                  {t(labels[stage], stage.replace(/_/g, " "))}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground px-1">
        {t(
          `case.status.${currentStatus}`,
          currentStatus.replace(/_/g, " ")
        )} ({currentIndex + 1}/{stages.length})
      </div>
    </div>
  );
}
