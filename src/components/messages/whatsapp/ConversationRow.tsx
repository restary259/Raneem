import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isWhatsAppSlaOverdue } from "@/lib/whatsappOperational";
import { whatsappStageClass, whatsappStageLabel } from "@/lib/whatsappStages";
import type { WhatsAppThread } from "@/services/WhatsAppService";
import { initials } from "./format";

/** One row of the conversation list. Presentation only — the parent owns state. */
export function ConversationRow({
  thread,
  active,
  simplified,
  now,
  lang,
  onSelect,
}: {
  thread: WhatsAppThread;
  active: boolean;
  simplified: boolean;
  now: number;
  lang: string;
  onSelect: () => void;
}) {
  const { t } = useTranslation("whatsapp");
  const name = thread.lead.student_name || thread.lead.whatsapp_number;
  const lastAt = thread.last_inbound_at ?? thread.last_outbound_at;
  const unread = (thread.unread_count ?? 0) > 0;
  const time = lastAt
    ? new Intl.DateTimeFormat(
        "en-GB",
        new Date(lastAt).toDateString() === new Date(now).toDateString()
          ? { hour: "2-digit", minute: "2-digit" }
          : { day: "2-digit", month: "short" },
      ).format(new Date(lastAt))
    : "";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex w-full items-center gap-2.5 border-b border-border/40 px-3 py-2 text-start transition-colors hover:bg-muted/40",
        active && "bg-brand/5",
      )}
    >
      {active && (
        <span
          className="absolute inset-y-0 start-0 w-0.5 bg-brand"
          aria-hidden="true"
        />
      )}
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
          unread
            ? "bg-brand text-brand-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {initials(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span
            dir="auto"
            className={cn(
              "truncate text-[13px]",
              unread ? "font-semibold" : "font-medium",
            )}
          >
            {name}
          </span>
          <span
            className={cn(
              "shrink-0 text-[10px]",
              unread ? "font-semibold text-brand" : "text-muted-foreground",
            )}
          >
            {time}
          </span>
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span dir="auto" className="truncate text-xs text-muted-foreground">
            {thread.last_message_preview ?? ""}
          </span>
          {unread && (
            <span className="grid h-4.5 min-w-4.5 shrink-0 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
              {thread.unread_count}
            </span>
          )}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1">
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
              whatsappStageClass(thread.lead.lead_stage),
            )}
          >
            {whatsappStageLabel(thread.lead.lead_stage, lang)}
          </span>
          {!thread.lead.student_name && (
            <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
              {t("identity.nameMissing", "No name yet")}
            </Badge>
          )}
          {!simplified && thread.priority !== "normal" && (
            <Badge
              variant={thread.priority === "urgent" ? "destructive" : "outline"}
              className="h-4 px-1.5 text-[9px]"
            >
              {t(`priority.${thread.priority}`, thread.priority)}
            </Badge>
          )}
          {!simplified && isWhatsAppSlaOverdue(thread, now) && (
            <Badge variant="destructive" className="h-4 px-1.5 text-[9px]">
              {t("sla.overdue")}
            </Badge>
          )}
        </span>
      </span>
    </button>
  );
}
