import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Check,
  CheckCheck,
  Clock,
  CheckCircle2,
  FolderOpen,
  Lock,
  Paperclip,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  canEditMessage,
  dayLabel,
  extractCaseRefs,
  formatTime,
  groupMessages,
  initials,
  splitChatBody,
  type ChatMessage,
  type MentionablePerson,
} from "@/lib/chatFormat";
import AttachmentPreview from "@/components/messages/AttachmentPreview";
import PayoutRequestCard from "@/components/messages/PayoutRequestCard";

import { resolveCaseRefs, type ThreadReadState } from "@/services/CaseMessageService";
import type { TypingPerson } from "@/hooks/useTypingIndicator";

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
  /** Read markers of the other participants — powers read receipts. */
  readState?: ThreadReadState[];
  /** People who can be mentioned, used to highlight @names. */
  mentionables?: MentionablePerson[];
  /** Staff only: route prefix for `#case` links, e.g. `/admin/cases`. */
  caseLinkBase?: string;
  /** Saves an edited message body. */
  onEditMessage?: (message: ChatMessage, body: string) => Promise<void>;
  /** People currently typing in this thread. */
  typing?: TypingPerson[];
  /** Loads the previous page of messages. */
  onLoadOlder?: () => void;
  hasOlder?: boolean;
  loadingOlder?: boolean;
  /** Label shown instead of an admin's real name on partner/student surfaces. */
  adminAlias?: string;
  /** Admins get the payout review actions on payout-request cards. */
  viewerIsAdmin?: boolean;
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
  readState,
  mentionables = [],
  caseLinkBase,
  onEditMessage,
  typing = [],
  onLoadOlder,
  hasOlder,
  loadingOlder,
  adminAlias,
  viewerIsAdmin = false,
}: MessageListProps) {

  const { t } = useTranslation("dashboard");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  /** Other participants' read markers, newest read first. */
  const readers = useMemo(
    () => (readState ?? []).filter((r) => r.user_id !== currentUserId),
    [readState, currentUserId],
  );

  const receiptFor = (message: ChatMessage) => {
    if (!currentUserId || message.authorId !== currentUserId || readers.length === 0) return null;
    const at = new Date(message.createdAt).getTime();
    const seenBy = readers.filter(
      (r) => r.last_read_at && new Date(r.last_read_at).getTime() >= at,
    );
    return { seenBy, all: seenBy.length === readers.length };
  };

  /** `#REF` tokens the viewer may open, mapped to their case id. */
  const [caseLinks, setCaseLinks] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!caseLinkBase) return;
    const refs = [...new Set(messages.flatMap((m) => extractCaseRefs(m.body)))];
    if (refs.length === 0) {
      setCaseLinks(new Map());
      return;
    }
    let active = true;
    resolveCaseRefs(refs)
      .then((map) => active && setCaseLinks(map))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [messages, caseLinkBase]);

  const renderBody = (body: string) =>
    splitChatBody(body, mentionables).map((seg, i) => {
      if (seg.mention) {
        return (
          <span key={i} className="rounded bg-primary/15 px-1 font-medium text-primary">
            {seg.text}
          </span>
        );
      }
      if (seg.caseRef) {
        const caseId = caseLinks.get(seg.caseRef);
        const chip = (
          <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 font-medium text-secondary-foreground">
            <FolderOpen className="h-3 w-3" />
            {seg.text}
          </span>
        );
        return caseId && caseLinkBase ? (
          <Link key={i} to={`${caseLinkBase}/${caseId}`} className="hover:underline">
            {chip}
          </Link>
        ) : (
          <span key={i}>{chip}</span>
        );
      }
      return <span key={i}>{seg.text}</span>;
    });


  const saveEdit = async () => {
    if (!editing || !onEditMessage) return;
    const message = messages.find((m) => m.id === editing.id);
    if (!message) return;
    setSaving(true);
    try {
      await onEditMessage(message, editing.body);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };


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
      {hasOlder && onLoadOlder && (
        <div className="flex justify-center">
          <Button size="sm" variant="ghost" disabled={loadingOlder} onClick={onLoadOlder}>
            {loadingOlder ? t("chat.loadingOlder") : t("chat.loadOlder")}
          </Button>
        </div>
      )}

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
                    {adminAlias && group.authorRole === "admin"
                      ? adminAlias
                      : group.authorName ||
                        t(`case.messages.role.${group.authorRole}`, group.authorRole ?? "")}
                  </span>
                  {group.authorRole && !(adminAlias && group.authorRole === "admin") && (
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

                    {editing?.id === m.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editing.body}
                          rows={2}
                          maxLength={5000}
                          onChange={(e) => setEditing({ id: m.id, body: e.target.value })}
                          className="resize-none text-sm"
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            {t("chat.edit.cancel")}
                          </Button>
                          <Button
                            size="sm"
                            disabled={saving || !editing.body.trim()}
                            onClick={saveEdit}
                          >
                            {t("chat.edit.save")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      m.body &&
                      m.kind !== "payout_request" && (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {renderBody(m.body)}
                        </p>
                      )
                    )}

                    {m.kind === "payout_request" && m.payoutRequestId && (
                      <PayoutRequestCard
                        requestId={m.payoutRequestId}
                        isAdmin={viewerIsAdmin}
                        caseLinkBase={caseLinkBase}
                        attachments={m.attachments}
                      />
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
                        "flex items-center gap-1.5 text-[11px] text-muted-foreground",
                        group.mine ? "justify-end" : "justify-start",
                      )}
                    >
                      <span>{formatTime(m.createdAt)}</span>
                      {m.editedAt && <span>· {t("chat.edit.edited")}</span>}
                      {onEditMessage && canEditMessage(m, currentUserId) && !editing && (
                        <button
                          type="button"
                          aria-label={t("chat.edit.button")}
                          onClick={() => setEditing({ id: m.id, body: m.body })}
                          className="transition-colors hover:text-foreground"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      {(() => {
                        const receipt = receiptFor(m);
                        if (!receipt) return null;
                        return receipt.all ? (
                          <span
                            className="flex items-center gap-0.5 text-primary"
                            title={t("chat.receipt.readByAll")}
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                          </span>
                        ) : receipt.seenBy.length > 0 ? (
                          <span
                            className="flex items-center gap-0.5"
                            title={t("chat.receipt.seenBy", {
                              names: receipt.seenBy.map((r) => r.full_name ?? "—").join(", "),
                            })}
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                            <span>{receipt.seenBy.length}</span>
                          </span>
                        ) : (
                          <span title={t("chat.receipt.sent")}>
                            <Check className="h-3.5 w-3.5" />
                          </span>

                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {typing.length > 0 && (
        <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
          </span>
          <span>
            {typing.length === 1
              ? t("chat.typing.one", { name: typing[0].name })
              : t("chat.typing.many", { count: typing.length })}
          </span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

