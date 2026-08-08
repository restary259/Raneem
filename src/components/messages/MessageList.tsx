import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Paperclip, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  dayLabel,
  formatTime,
  groupMessages,
  initials,
  type ChatMessage,
} from "@/lib/chatFormat";
import AttachmentPreview from "@/components/messages/AttachmentPreview";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string | null;
  loading?: boolean;
  emptyLabel: string;
  className?: string;
  /** Shown under an unfulfilled document request when the viewer can answer it. */
  onFulfilRequest?: (message: ChatMessage) => void;
  canFulfilRequests?: boolean;
  onlineUserIds?: Set<string>;
}

export default function MessageList({
  messages,
  currentUserId,
  loading,
  emptyLabel,
  className,
  onFulfilRequest,
  canFulfilRequests,
  onlineUserIds,
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
    <div className={cn("space-y-5 p-4", className)}>
      {groups.map((group) => {
        const showDay = group.day !== renderedDay;
        renderedDay = group.day;
        const label = dayLabel(group.messages[0].createdAt);
        const dayText = label.type === "date" ? label.value : t(`chat.day.${label.type}`);
        const isOnline = !!group.authorId && !!onlineUserIds?.has(group.authorId);

        return (
          <div key={`${group.day}-${group.messages[0].id}`} className="space-y-2">
            {showDay && (
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-border" />
                <span className="rounded-full border bg-card px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {dayText}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}

            <div className={cn("flex gap-2", group.mine ? "flex-row-reverse" : "flex-row")}>
              <div className="relative mt-1 shrink-0">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold",
                    group.mine
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {initials(
                    group.authorName ||
                      (group.authorRole
                        ? t(`case.messages.role.${group.authorRole}`, group.authorRole)
                        : "?"),
                  )}
                </div>
                {isOnline && (
                  <span
                    title={t("chat.presence.online")}
                    className="absolute -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card ltr:-right-0.5 rtl:-left-0.5"
                  />
                )}
              </div>

              <div className={cn("flex max-w-[78%] flex-col gap-1", group.mine && "items-end")}>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
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
                      "space-y-2 rounded-2xl border px-3.5 py-2.5 shadow-sm",
                      group.mine
                        ? "rounded-ee-sm border-primary/25 bg-primary/10"
                        : "rounded-es-sm border-border bg-card",
                      m.visibility === "internal" && "border-amber-300/70 bg-amber-50",
                      m.kind === "request" && "border-sky-300/70 bg-sky-50",
                    )}
                  >
                    {(m.visibility === "internal" || m.kind === "request") && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {m.visibility === "internal" && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-400 bg-amber-100 text-[11px] text-amber-900"
                          >
                            <Lock className="h-3 w-3" />
                            {t("case.messages.internal")}
                          </Badge>
                        )}
                        {m.kind === "request" && (
                          <>
                            <Badge variant="outline" className="gap-1 text-[11px]">
                              <Paperclip className="h-3 w-3" />
                              {t("chat.request.badge")}
                            </Badge>
                            <Badge
                              variant={m.requestStatus === "fulfilled" ? "default" : "secondary"}
                              className="gap-1 text-[11px]"
                            >
                              {m.requestStatus === "fulfilled" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              {t(`chat.request.status.${m.requestStatus ?? "pending"}`)}
                            </Badge>
                          </>
                        )}
                      </div>
                    )}

                    {m.body && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                    )}

                    {m.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {m.attachments.map((att) => (
                          <AttachmentPreview key={att.path} att={att} />
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
                        "text-[11px] text-muted-foreground",
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
