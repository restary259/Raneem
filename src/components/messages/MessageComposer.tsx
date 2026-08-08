import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  AtSign,
  FileUp,
  Loader2,
  Lock,
  Paperclip,
  RotateCw,
  Send,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ALLOWED_ATTACHMENT_LABEL,
  ALLOWED_ATTACHMENT_MIMES,
  MAX_ATTACHMENT_BYTES,
  activeMentionQuery,
  applyMention,
  formatFileSize,
  resolveMentionIds,
  validateAttachmentFile,
  type ChatAttachment,
  type MentionablePerson,
} from "@/lib/chatFormat";
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
  /** Called (throttled by the caller) while the user is typing. */
  onTyping?: () => void;
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
  onTyping,
}: MessageComposerProps) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "shared">("shared");
  const [kind, setKind] = useState<"text" | "request">("text");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionables.filter((p) => p.name && p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQuery, mentionables]);

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

  return (
    <div
      className={cn(
        "space-y-2 border-t bg-card px-3 py-2.5",
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

      <div className="relative">
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

        <Textarea
          ref={textRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setMentionQuery(
              mentionables.length > 0
                ? activeMentionQuery(e.target.value, e.target.selectionStart ?? 0)
                : null,
            );
            if (e.target.value.trim()) onTyping?.();
          }}
          onBlur={() => window.setTimeout(() => setMentionQuery(null), 150)}
          placeholder={
            kind === "request" ? t("chat.request.placeholder") : t("case.messages.placeholder")
          }
          rows={2}
          maxLength={5000}
          disabled={disabled}
          className="resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Escape" && mentionQuery !== null) {
              setMentionQuery(null);
              return;
            }
            if (e.key === "Tab" && mentionMatches.length > 0) {
              e.preventDefault();
              pickMention(mentionMatches[0]);
              return;
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
      </div>


      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            accept={ALLOWED_ATTACHMENT_MIMES.join(",")}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1 text-muted-foreground"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
            {t("chat.attach.button")}
          </Button>

          {allowRequests && (
            <Button
              type="button"
              size="sm"
              variant={kind === "request" ? "secondary" : "ghost"}
              className={cn("gap-1", kind !== "request" && "text-muted-foreground")}
              onClick={() => setKind((k) => (k === "request" ? "text" : "request"))}
            >
              <FileUp className="h-4 w-4" />
              {t("chat.request.button")}
            </Button>
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
          size="sm"
          onClick={handleSend}
          disabled={disabled || sending || uploading || (!body.trim() && ready.length === 0)}
          className="gap-1"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t("case.messages.send")}
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
