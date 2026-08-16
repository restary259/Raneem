import React from "react";
import { useTranslation } from "react-i18next";
import { CalendarOff, ChevronLeft, ChevronRight, ClipboardList, FileX, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toneClasses } from "@/lib/statusTokens";
import type { CaseTask } from "./caseTasks";

interface Props {
  tasks: CaseTask[];
  onAction: (task: CaseTask) => void;
}

const ICONS: Record<CaseTask["action"], React.ElementType> = {
  upload_document: FileX,
  schedule_appointment: CalendarOff,
  record_outcome: ClipboardList,
  add_note: StickyNote,
};

const ACTION_LABEL: Record<CaseTask["action"], string> = {
  upload_document: "case.tasks.action.uploadDocument",
  schedule_appointment: "case.tasks.action.schedule",
  record_outcome: "case.tasks.action.recordOutcome",
  add_note: "case.tasks.action.addNote",
};

/** Live task panel: the most blocking item gets the button, the rest are rows. */
export default function CaseAttentionPanel({ tasks, onAction }: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.dir() === "rtl";
  if (tasks.length === 0) return null;

  const [primary, ...rest] = tasks;
  const Chevron = isRtl ? ChevronLeft : ChevronRight;
  const attention = toneClasses("payment");

  return (
    <section
      aria-label={t("case.tasks.title", "Needs attention now")}
      className={`rounded-xl border px-4 py-3.5 sm:px-5 flex flex-col gap-2.5 ${attention.tint} border-[hsl(var(--status-payment)/0.28)]`}
    >
      <p className={`text-xs font-medium ${attention.text}`}>{t("case.tasks.title", "Needs attention now")}</p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-foreground">{t(primary.labelKey, primary.values)}</span>
        <Button
          size="sm"
          className={`${attention.fill} hover:opacity-90 text-white shrink-0`}
          onClick={() => onAction(primary)}
        >
          {t(ACTION_LABEL[primary.action])}
        </Button>
      </div>

      {rest.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-[hsl(var(--status-payment)/0.28)] pt-2.5">
          {rest.map((task) => {
            const Icon = ICONS[task.action];
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onAction(task)}
                className="flex items-center gap-2 rounded-md px-1 py-1.5 text-start text-sm text-foreground hover:bg-[hsl(var(--status-payment)/0.07)] transition-colors"
              >
                <Icon className={`h-4 w-4 shrink-0 ${attention.text}`} aria-hidden />
                <span className="flex-1">{t(task.labelKey, task.values)}</span>
                <Chevron className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
