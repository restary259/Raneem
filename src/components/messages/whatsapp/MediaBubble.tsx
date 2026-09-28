import { FileText, Mic } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchWhatsAppMedia, whatsAppMediaUrl } from "@/services/WhatsAppService";

/**
 * Attachments live in a private bucket, so each bubble asks for its own signed
 * link. Incoming files that were never downloaded are fetched from WhatsApp on
 * first view (messageId + no path).
 */
export function MediaBubble({
  path,
  messageId,
  messageType,
  mime,
  filename,
  openLabel,
  unavailableLabel,
}: {
  path: string | null;
  messageId?: string;
  messageType?: string;
  mime: string | null;
  filename: string | null;
  openLabel: string;
  unavailableLabel: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(mime);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    (async () => {
      try {
        let p = path;
        if (!p && messageId) {
          const res = await fetchWhatsAppMedia(messageId);
          p = res.path;
          if (!cancelled && res.mime) setKind(res.mime);
        }
        if (!p) throw new Error("no path");
        const signed = await whatsAppMediaUrl(p);
        if (!cancelled) setUrl(signed);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, messageId]);

  if (failed)
    return (
      <p className="mb-1 flex items-center gap-1.5 text-xs opacity-70">
        <FileText className="h-3.5 w-3.5" />
        {unavailableLabel}
      </p>
    );
  if (!url) return <div className="mb-1 h-12 w-48 animate-pulse rounded-md bg-muted" />;

  const m = kind ?? "";
  const isAudio = m.startsWith("audio/") || messageType === "audio";
  if (m.startsWith("image/") || messageType === "sticker" || messageType === "image")
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={filename ?? ""}
          className={messageType === "sticker" ? "mb-1 h-32 w-32 object-contain" : "mb-1 max-h-72 rounded-md object-cover"}
        />
      </a>
    );
  if (m.startsWith("video/") || messageType === "video")
    return <video src={url} controls playsInline className="mb-1 max-h-72 rounded-md" />;
  if (isAudio)
    return (
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Mic className="h-4 w-4" />
        </span>
        <audio src={url} controls preload="metadata" className="h-9 w-56 max-w-full" />
      </div>
    );
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={filename ?? undefined}
      className="mb-1 flex items-center gap-2 rounded-md border border-border bg-background/60 p-2 text-xs"
    >
      <FileText className="h-5 w-5 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{filename ?? openLabel}</span>
        <span className="block uppercase opacity-60">{(m.split("/")[1] || "file").slice(0, 10)}</span>
      </span>
    </a>
  );
}
