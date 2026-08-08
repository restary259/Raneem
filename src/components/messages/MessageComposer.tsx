import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileUp, Loader2, Lock, Paperclip, Send, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ALLOWED_ATTACHMENT_MIMES,
  formatFileSize,
  validateAttachmentFile,
  type ChatAttachment,
} from "@/lib/chatFormat";
import { uploadChatAttachment } from "@/services/ChatAttachmentService";

interface MessageComposerProps {
  threadType: "case" | "direct";
  threadId: string;
  onSend: (
    body: string,
    attachments: ChatAttachment[],
    opts: { visibility: "internal" | "shared"; kind: "text" | "request" },
  ) => Promise<void>;
  /** Staff can toggle internal notes and send document requests. */
  allowInternal?: boolean;
  allowRequests?: boolean;
  disabled?: boolean;
  hint?: string;
}

export default function MessageComposer({
  threadType,
  threadId,
  onSend,
  allowInternal = false,
  allowRequests = false,
  disabled = false,
  hint,
}: MessageComposerProps) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "shared">("shared");
  const [kind, setKind] = useState<"text" | "request">("text");
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const file of list) {
        const invalid = validateAttachmentFile(file);
        if (invalid) {
          toast({ variant: "destructive", description: t(`chat.attach.error.${invalid}`) });
          continue;
        }
        const att = await uploadChatAttachment(threadType, threadId, file);
        setPending((prev) => [...prev, att]);
      }
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSend = async () => {
    const trimmed = body.trim();
    if ((!trimmed && pending.length === 0) || sending) return;
    setSending(true);
    try {
      await onSend(trimmed, pending, { visibility: allowInternal ? visibility : "shared", kind });
      setBody("");
      setPending([]);
      setKind("text");
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={cn(
        "space-y-2 border-t bg-background p-3",
        dragging && "ring-2 ring-primary ring-offset-2",
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
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pending.map((att) => (
            <span
              key={att.path}
              className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs"
            >
              <span className="max-w-[160px] truncate">{att.name}</span>
              <span className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</span>
              <button
                type="button"
                aria-label={t("chat.attach.remove")}
                onClick={() => setPending((prev) => prev.filter((p) => p.path !== att.path))}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={kind === "request" ? t("chat.request.placeholder") : t("case.messages.placeholder")}
        rows={3}
        maxLength={5000}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSend();
          }
        }}
      />

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
            variant="outline"
            className="gap-1"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
            {t("chat.attach.button")}
          </Button>

          {allowRequests && (
            <Button
              type="button"
              size="sm"
              variant={kind === "request" ? "default" : "outline"}
              className="gap-1"
              onClick={() => setKind((k) => (k === "request" ? "text" : "request"))}
            >
              <FileUp className="h-3.5 w-3.5" />
              {t("chat.request.button")}
            </Button>
          )}

          {allowInternal && (
            <>
              <Button
                type="button"
                size="sm"
                variant={visibility === "shared" ? "default" : "outline"}
                onClick={() => setVisibility("shared")}
                className="gap-1"
              >
                <Users className="h-3.5 w-3.5" />
                {t("case.messages.shared")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={visibility === "internal" ? "default" : "outline"}
                onClick={() => setVisibility("internal")}
                className="gap-1"
              >
                <Lock className="h-3.5 w-3.5" />
                {t("case.messages.internal")}
              </Button>
            </>
          )}
        </div>

        <Button
          size="sm"
          onClick={handleSend}
          disabled={disabled || sending || (!body.trim() && pending.length === 0)}
          className="gap-1"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t("case.messages.send")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
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
