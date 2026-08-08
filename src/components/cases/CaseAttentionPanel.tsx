import React from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileX,
  PhoneOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseTask } from "./caseTasks";

interface Props {
  tasks: CaseTask[];
  onAction: (task: CaseTask) => void;
}

const ICONS: Record<CaseTask["action"], React.ElementType> = {
  confirm_payment: AlertTriangle,
  upload_document: FileX,
  schedule_appointment: CalendarOff,
  record_outcome: ClipboardList,
  add_note: PhoneOff,
};

const ACTION_LABEL: Record<CaseTask["action"], string> = {
  confirm_payment: "case.tasks.action.confirmPayment",
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

  return (
    <section
      aria-label={t("case.tasks.title", "Needs attention now")}
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 sm:px-5 flex flex-col gap-2.5"
    >
      <p className="text-xs font-medium text-amber-700">{t("case.tasks.title", "Needs attention now")}</p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-foreground">{t(primary.labelKey, primary.values)}</span>
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-amber-50 shrink-0"
          onClick={() => onAction(primary)}
        >
          {t(ACTION_LABEL[primary.action])}
        </Button>
      </div>

      {rest.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-amber-200 pt-2.5">
          {rest.map((task) => {
            const Icon = ICONS[task.action];
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onAction(task)}
                className="flex items-center gap-2 rounded-md px-1 py-1.5 text-start text-sm text-foreground hover:bg-amber-100/70 transition-colors"
              >
                <Icon className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
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
