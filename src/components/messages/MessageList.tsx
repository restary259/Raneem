import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Image as ImageIcon, Lock, Paperclip, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  dayLabel,
  formatFileSize,
  formatTime,
  groupMessages,
  initials,
  isImageAttachment,
  type ChatAttachment,
  type ChatMessage,
} from "@/lib/chatFormat";
import { openAttachment } from "@/services/ChatAttachmentService";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string | null;
  loading?: boolean;
  emptyLabel: string;
  className?: string;
  /** Shown under an unfulfilled document request when the viewer can answer it. */
  onFulfilRequest?: (message: ChatMessage) => void;
  canFulfilRequests?: boolean;
}

function AttachmentChip({ att }: { att: ChatAttachment }) {
  const { t } = useTranslation("dashboard");
  const Icon = isImageAttachment(att) ? ImageIcon : FileText;
  return (
    <button
      type="button"
      onClick={() => openAttachment(att.path)}
      title={t("chat.openAttachment")}
      className="flex items-center gap-2 rounded-md border bg-background/70 px-2 py-1.5 text-start transition-colors hover:bg-accent"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="max-w-[180px] truncate text-xs font-medium">{att.name}</span>
      <span className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</span>
    </button>
  );
}

export default function MessageList({
  messages,
  currentUserId,
  loading,
  emptyLabel,
  className,
  onFulfilRequest,
  canFulfilRequests,
}: MessageListProps) {
  const { t } = useTranslation("dashboard");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (loading) {
    return (
      <div className={cn("space-y-3 p-4", className)}>
        <Skeleton className="h-16" />
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn("flex h-full items-center justify-center p-8", className)}>
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  const groups = groupMessages(messages, currentUserId);
  let renderedDay: string | null = null;

  return (
    <div className={cn("space-y-4 p-4", className)}>
      {groups.map((group) => {
        const showDay = group.day !== renderedDay;
        renderedDay = group.day;
        const label = dayLabel(group.messages[0].createdAt);
        const dayText =
          label.type === "date" ? label.value : t(`chat.day.${label.type}`);

        return (
          <div key={`${group.day}-${group.messages[0].id}`} className="space-y-2">
            {showDay && (
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  {dayText}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}

            <div className={cn("flex gap-2", group.mine ? "flex-row-reverse" : "flex-row")}>
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                {initials(
                  group.authorName ||
                    (group.authorRole ? t(`case.messages.role.${group.authorRole}`, group.authorRole) : "?"),
                )}
              </div>

              <div className={cn("max-w-[78%] space-y-1", group.mine && "items-end")}>
                <div
                  className={cn(
                    "flex items-center gap-2 text-[11px] text-muted-foreground",
                    group.mine && "justify-end",
                  )}
                >
                  <span className="font-semibold text-foreground">
                    {group.authorName ||
                      t(`case.messages.role.${group.authorRole}`, group.authorRole ?? "")}
                  </span>
                  {group.authorRole && (
                    <span>{t(`case.messages.role.${group.authorRole}`, group.authorRole)}</span>
                  )}
                </div>

                {group.messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 space-y-2",
                      group.mine ? "bg-primary/10 border-primary/20" : "bg-muted/40",
                      m.visibility === "internal" && "border-amber-300 bg-amber-50",
                      m.kind === "request" && "border-sky-300 bg-sky-50",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {m.visibility === "internal" && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Lock className="h-3 w-3" />
                          {t("case.messages.internal")}
                        </Badge>
                      )}
                      {m.kind === "request" && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Paperclip className="h-3 w-3" />
                          {t("chat.request.badge")}
                        </Badge>
                      )}
                      {m.kind === "request" && (
                        <Badge
                          variant={m.requestStatus === "fulfilled" ? "default" : "secondary"}
                          className="gap-1 text-[10px]"
                        >
                          {m.requestStatus === "fulfilled" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {t(`chat.request.status.${m.requestStatus ?? "pending"}`)}
                        </Badge>
                      )}
                    </div>

                    {m.body && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                    )}

                    {m.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {m.attachments.map((att) => (
                          <AttachmentChip key={att.path} att={att} />
                        ))}
                      </div>
                    )}

                    {m.kind === "request" &&
                      m.requestStatus !== "fulfilled" &&
                      canFulfilRequests &&
                      !group.mine &&
                      onFulfilRequest && (
                        <Button size="sm" variant="outline" onClick={() => onFulfilRequest(m)}>
                          {t("chat.request.upload")}
                        </Button>
                      )}

                    <div
                      className={cn(
                        "text-[10px] text-muted-foreground",
                        group.mine ? "text-end" : "text-start",
                      )}
                    >
                      {formatTime(m.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
