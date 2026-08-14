import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import type { PipelineStatus } from "@/lib/caseStatus";
import { cn } from "@/lib/utils";
import { StatusSteps } from "@/components/cases/CaseVisuals";
import { Button } from "@/components/ui/button";
import { stageBlockReason } from "@/services/CaseStageService";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

  const blockReason = stageBlockReason(currentKey);
  const blockHint = !blockReason
    ? ""
    : blockReason.kind === "terminal"
      ? t("case.stage.reasonTerminal", "This case has reached the final stage.")
      : blockReason.kind === "inactive"
        ? t("case.stage.reasonInactive", "Reopen the case before moving it forward.")
        : t("case.stage.reasonAutomated", {
            stage: label(blockReason.stage),
            trigger: t(
              `case.stage.automatedTrigger.${blockReason.stage}`,
              "the required step completes",
            ),
            defaultValue:
              "Next stage is {{stage}} — it happens automatically once {{trigger}} is recorded.",
          });
  const hintId = "case-stage-hint";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <StatusSteps statuses={statuses} currentKey={currentKey} className="min-w-0 flex-1" />


      {onAdvance &&
        (nextStages.length === 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0" tabIndex={0} aria-describedby={hintId}>
                <Button size="sm" variant="outline" className="pointer-events-none gap-1.5" disabled>
                  {t("case.stage.advance", "Move to next stage")}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent id={hintId} className="max-w-[16rem] text-center">
              {blockHint}
            </TooltipContent>
          </Tooltip>
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
              <DropdownMenuLabel>
                {t("case.stage.chooseNext", "Choose the next stage")}
              </DropdownMenuLabel>
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
