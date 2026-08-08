import React from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight } from "lucide-react";
import type { PipelineStatus } from "@/lib/caseStatus";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  statuses: PipelineStatus[];
  currentKey: string;
  /** Stages the user may move to by hand. Omit to render the rail only. */
  nextStages?: string[];
  onAdvance?: (nextKey: string) => void;
  advancing?: boolean;
}

/**
 * Compact dot-and-line rail: filled dots for completed stages, a ringed dot for
 * the current stage, muted dots for what is still ahead. When `onAdvance` is
 * supplied a "move to next stage" control is rendered beside the rail.
 */
export default function CaseProgressRail({
  statuses,
  currentKey,
  nextStages = [],
  onAdvance,
  advancing = false,
}: Props) {
  const { t } = useTranslation("dashboard");
  const stages = statuses.filter((s) => s.is_active && !["forgotten", "cancelled"].includes(s.key));
  const currentIndex = stages.findIndex((s) => s.key === currentKey);
  const label = (key: string) =>
    t(`case.status.${key}`, statuses.find((s) => s.key === key)?.label_en ?? key);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div
        className="flex min-w-0 flex-1 items-center"
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
                title={label(stage.key)}
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

      {onAdvance &&
        (nextStages.length === 0 ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            disabled
            title={t(
              "case.stage.automatedHint",
              "The next stage happens automatically once payment or admin review completes",
            )}
          >
            {t("case.stage.advance", "Move to next stage")}
          </Button>
        ) : nextStages.length === 1 ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            disabled={advancing}
            onClick={() => onAdvance(nextStages[0])}
          >
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            {t("case.stage.moveTo", { stage: label(nextStages[0]), defaultValue: "Move to {{stage}}" })}
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="shrink-0 gap-1.5" disabled={advancing}>
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                {t("case.stage.advance", "Move to next stage")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {nextStages.map((key) => (
                <DropdownMenuItem key={key} onSelect={() => onAdvance(key)}>
                  {label(key)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
    </div>
  );
}
