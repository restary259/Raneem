import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  AtSign,
  Banknote,
  Hash,
  FileUp,
  Loader2,
  Lock,
  Paperclip,
  Plus,
  RotateCw,
  Send,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import {
  ALLOWED_ATTACHMENT_LABEL,
  ALLOWED_ATTACHMENT_MIMES,
  MAX_ATTACHMENT_BYTES,
  activeCaseQuery,
  activeMentionQuery,
  applyCaseMention,
  applyMention,
  caseMentionToken,
  formatFileSize,
  resolveMentionIds,
  validateAttachmentFile,
  type ChatAttachment,
  type MentionableCase,
  type MentionablePerson,
} from "@/lib/chatFormat";
import { searchCasesForMention } from "@/services/CaseMessageService";
import {
  removeChatAttachment,
  uploadChatAttachmentWithProgress,
} from "@/services/ChatAttachmentService";

interface MessageComposerProps {
  threadType: "case" | "direct";
  threadId: string;
  onSend: (
    body: string,
    attachments: ChatAttachment[],
    opts: { visibility: "internal" | "shared"; kind: "text" | "request"; mentions: string[] },
  ) => Promise<void>;
  /** Staff can toggle internal notes and send document requests. */
  allowInternal?: boolean;
  allowRequests?: boolean;
  disabled?: boolean;
  hint?: string;
  /** People who can be @mentioned in this thread. */
  mentionables?: MentionablePerson[];
  /** Staff only: allow referencing a case file with `#`. */
  allowCaseMentions?: boolean;
  /** Called (throttled by the caller) while the user is typing. */
  onTyping?: () => void;
  /** Partners only: opens the structured payout-request flow from the `+` menu. */
  onRequestPayout?: () => void;

}

type UploadItem = {
  id: string;
  file: File;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
  attachment?: ChatAttachment;
  cancel?: () => void;
};

export default function MessageComposer({
  threadType,
  threadId,
  onSend,
  allowInternal = false,
  allowRequests = false,
  disabled = false,
  hint,
  mentionables = [],
  allowCaseMentions = false,
  onTyping,
  onRequestPayout,

}: MessageComposerProps) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "shared">("shared");
  const [kind, setKind] = useState<"text" | "request">("text");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [caseQuery, setCaseQuery] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  /* The suggestion lists close on a real click outside the composer, not on
     blur: the attach menu momentarily steals focus from the textarea, and a
     blur timer made the popup appear and vanish immediately. */
  useEffect(() => {
    if (mentionQuery === null && caseQuery === null) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setMentionQuery(null);
      setCaseQuery(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mentionQuery, caseQuery]);
  const [caseMatches, setCaseMatches] = useState<MentionableCase[]>([]);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionables.filter((p) => p.name && p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQuery, mentionables]);

  /** Debounced case lookup for the active `#query`. */
  useEffect(() => {
    if (!allowCaseMentions || caseQuery === null) {
      setCaseMatches([]);
      return;
    }
    let active = true;
    const handle = window.setTimeout(() => {
      searchCasesForMention(caseQuery)
        .then((rows) => {
          if (!active) return;
          setCaseMatches(
            rows.slice(0, 6).map((c) => ({
              id: c.id,
              reference: c.case_reference,
              name: c.full_name,
              status: c.status,
            })),
          );
        })
        .catch(() => active && setCaseMatches([]));
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [allowCaseMentions, caseQuery]);

  /** Grow the composer with the message, up to a capped height. */
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [body]);

  const pickCase = (c: MentionableCase) => {
    const el = textRef.current;
    const caret = el?.selectionStart ?? body.length;
    const next = applyCaseMention(body, caret, caseMentionToken(c));
    setBody(next.text);
    setCaseQuery(null);
    setCaseMatches([]);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };


  const pickMention = (person: MentionablePerson) => {
    const el = textRef.current;
    const caret = el?.selectionStart ?? body.length;
    const next = applyMention(body, caret, person.name);
    setBody(next.text);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };


  const patch = (id: string, next: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));

  const startUpload = (item: UploadItem) => {
    const handle = uploadChatAttachmentWithProgress(threadType, threadId, item.file, (p) =>
      patch(item.id, { progress: p }),
    );
    patch(item.id, { status: "uploading", progress: 0, error: undefined, cancel: handle.cancel });
    handle.promise
      .then((att) => patch(item.id, { status: "done", progress: 100, attachment: att }))
      .catch((err: any) => {
        if (err?.name === "AbortError") {
          setItems((prev) => prev.filter((it) => it.id !== item.id));
          return;
        }
        patch(item.id, {
          status: "error",
          error: err?.message === "network" ? t("chat.attach.error.network") : err?.message,
        });
      });
  };

  const addFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const invalid = validateAttachmentFile(file);
      if (invalid) {
        toast({
          variant: "destructive",
          title: file.name,
          description:
            invalid === "size"
              ? t("chat.attach.error.sizeDetail", {
                  size: formatFileSize(file.size),
                  max: formatFileSize(MAX_ATTACHMENT_BYTES),
                })
              : t("chat.attach.error.mimeDetail", { types: ALLOWED_ATTACHMENT_LABEL }),
        });
        continue;
      }
      const item: UploadItem = {
        id: crypto.randomUUID(),
        file,
        status: "uploading",
        progress: 0,
      };
      setItems((prev) => [...prev, item]);
      startUpload(item);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeItem = (item: UploadItem) => {
    item.cancel?.();
    if (item.attachment) removeChatAttachment(item.attachment.path).catch(() => undefined);
    setItems((prev) => prev.filter((it) => it.id !== item.id));
  };

  const uploading = items.some((it) => it.status === "uploading");
  const ready = items.filter((it) => it.status === "done" && it.attachment);

  const handleSend = async () => {
    const trimmed = body.trim();
    if ((!trimmed && ready.length === 0) || sending || uploading) return;
    setSending(true);
    try {
      await onSend(trimmed, ready.map((it) => it.attachment!), {
        visibility: allowInternal ? visibility : "shared",
        kind,
        mentions: resolveMentionIds(trimmed, mentionables),
      });
      setBody("");
      setItems([]);
      setKind("text");
      setMentionQuery(null);

    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSending(false);
    }
  };

  /** Insert a trigger character (`@` / `#`) at the caret and open its picker. */
  const insertToken = (token: "@" | "#") => {
    const el = textRef.current;
    const caret = el?.selectionStart ?? body.length;
    setBody(`${body.slice(0, caret)}${token}${body.slice(caret)}`);
    if (token === "@") setMentionQuery("");
    else setCaseQuery("");
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret + 1, caret + 1);
    });
  };

  /* One action list, rendered as a dropdown on desktop and as a WhatsApp-style
     icon grid in a bottom sheet on mobile. */
  const actions: {
    key: string;
    label: string;
    icon: typeof Paperclip;
    tone: string;
    run: () => void;
  }[] = [
    {
      key: "attach",
      label: t("chat.attach.button"),
      icon: Paperclip,
      tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
      run: () => fileRef.current?.click(),
    },
    ...(mentionables.length > 0
      ? [
          {
            key: "mention",
            label: t("chat.mention.button"),
            icon: AtSign,
            tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
            run: () => insertToken("@"),
          },
        ]
      : []),
    ...(allowCaseMentions
      ? [
          {
            key: "case",
            label: t("chat.caseMention.button"),
            icon: Hash,
            tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
            run: () => insertToken("#"),
          },
        ]
      : []),
    ...(allowRequests
      ? [
          {
            key: "request",
            label: t("chat.request.button"),
            icon: FileUp,
            tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
            run: () => setKind((k) => (k === "request" ? "text" : "request")),
          },
        ]
      : []),
    ...(onRequestPayout
      ? [
          {
            key: "payout",
            label: t("chat.payout.request"),
            icon: Banknote,
            tone: "bg-primary/15 text-primary",
            run: () => onRequestPayout(),
          },
        ]
      : []),
  ];

  return (

    <div
      ref={rootRef}
      className={cn(
        "space-y-1.5 border-t bg-card px-2.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:space-y-2 sm:px-4 sm:py-3",
        dragging && "bg-primary/5 ring-1 ring-inset ring-primary",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
    >
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "w-56 rounded-lg border bg-muted/40 px-2.5 py-2",
                item.status === "error" && "border-destructive/40 bg-destructive/5",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {item.file.name}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatFileSize(item.file.size)}
                </span>
                {item.status === "error" && (
                  <button
                    type="button"
                    aria-label={t("chat.attach.retry")}
                    onClick={() => startUpload(item)}
                  >
                    <RotateCw className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={t("chat.attach.remove")}
                  onClick={() => removeItem(item)}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              {item.status === "uploading" && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Progress value={item.progress} className="h-1.5 flex-1" />
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {item.progress}%
                  </span>
                </div>
              )}
              {item.status === "error" && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span className="truncate">{item.error ?? t("chat.attach.error.failed")}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="relative rounded-2xl border bg-background px-3 py-2 transition-colors focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
        {mentionMatches.length > 0 && (
          <ul className="absolute bottom-full z-30 mb-2 w-64 overflow-hidden rounded-lg border bg-popover shadow-lg">
            {mentionMatches.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => pickMention(person)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-accent"
                >
                  <span className="truncate">{person.name}</span>
                  {person.role && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {t(`case.messages.role.${person.role}`, person.role)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {caseMatches.length > 0 && (
          <ul className="absolute bottom-full z-30 mb-2 w-72 overflow-hidden rounded-lg border bg-popover shadow-lg">
            {caseMatches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pickCase(c)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-accent"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{caseMentionToken(c)}</span>
                    <span className="truncate text-[11px] text-muted-foreground">{c.name}</span>
                  </span>
                  {c.status && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {t(`case.status.${c.status}`, c.status)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <Textarea
          value={body}
          onChange={(e) => {
            const caret = e.target.selectionStart ?? 0;
            setBody(e.target.value);
            setMentionQuery(
              mentionables.length > 0 ? activeMentionQuery(e.target.value, caret) : null,
            );
            setCaseQuery(allowCaseMentions ? activeCaseQuery(e.target.value, caret) : null);
            if (e.target.value.trim()) onTyping?.();
          }}
          placeholder={
            kind === "request" ? t("chat.request.placeholder") : t("case.messages.placeholder")
          }
          rows={1}
          maxLength={5000}
          disabled={disabled}
          ref={textRef}
          /* 16px on mobile keeps iOS Safari from zooming the page on focus. */
          className="max-h-[140px] min-h-[24px] resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0 sm:text-sm"
          onKeyDown={(e) => {
            if (e.key === "Escape" && (mentionQuery !== null || caseQuery !== null)) {
              setMentionQuery(null);
              setCaseQuery(null);
              return;
            }
            if (e.key === "Tab" && mentionMatches.length > 0) {
              e.preventDefault();
              pickMention(mentionMatches[0]);
              return;
            }
            if (e.key === "Tab" && caseMatches.length > 0) {
              e.preventDefault();
              pickCase(caseMatches[0]);
              return;
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
      </div>


      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            accept={ALLOWED_ATTACHMENT_MIMES.join(",")}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />

          {isMobile ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-full border text-muted-foreground"
                disabled={disabled}
                aria-label={t("chat.actions.menu")}
                onClick={() => setSheetOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>

              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent
                  side="bottom"
                  className="rounded-t-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))]"
                >
                  <SheetHeader className="text-start">
                    <SheetTitle className="text-base">{t("chat.actions.menu")}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    {actions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => {
                          setSheetOpen(false);
                          // Let the sheet close before focusing the textarea.
                          requestAnimationFrame(() => action.run());
                        }}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <span
                          className={cn(
                            "flex h-14 w-14 items-center justify-center rounded-full",
                            action.tone,
                          )}
                        >
                          <action.icon className="h-6 w-6" />
                        </span>
                        <span className="text-[11px] leading-tight text-muted-foreground">
                          {action.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full border text-muted-foreground"
                  disabled={disabled}
                  aria-label={t("chat.actions.menu")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
                collisionPadding={12}
                className="z-50 w-56"
                onCloseAutoFocus={(e) => {
                  // Radix returns focus to the trigger, which blurs the textarea
                  // and would hide the mention list we just opened.
                  e.preventDefault();
                  textRef.current?.focus();
                }}
              >
                {actions.map((action) => (
                  <DropdownMenuItem
                    key={action.key}
                    className="gap-2"
                    onSelect={() => action.run()}
                  >
                    <action.icon className="h-4 w-4" />
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}


          {kind === "request" && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-900 dark:bg-sky-500/20 dark:text-sky-200">
              {t("chat.request.badge")}
            </span>
          )}

          {allowInternal && (
            <div className="flex items-center rounded-full border p-0.5">
              <button
                type="button"
                onClick={() => setVisibility("shared")}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors",
                  visibility === "shared"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                <Users className="h-3.5 w-3.5" />
                {t("case.messages.shared")}
              </button>
              <button
                type="button"
                onClick={() => setVisibility("internal")}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors",
                  visibility === "internal"
                    ? "bg-amber-500 text-white"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                <Lock className="h-3.5 w-3.5" />
                {t("case.messages.internal")}
              </button>
            </div>
          )}
        </div>

        <Button
          size="icon"
          onClick={handleSend}
          aria-label={t("case.messages.send")}
          disabled={disabled || sending || uploading || (!body.trim() && ready.length === 0)}
          className="h-8 w-8 shrink-0 rounded-full"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>


      <p className="text-[11px] text-muted-foreground">
        {hint ??
          (allowInternal
            ? visibility === "internal"
              ? t("case.messages.internalHint")
              : t("case.messages.sharedHint")
            : t("case.messages.studentHint"))}
      </p>
    </div>
  );
}
