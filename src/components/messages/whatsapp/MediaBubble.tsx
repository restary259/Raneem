import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { whatsAppMediaUrl } from "@/services/WhatsAppService";

/** Attachments live in a private bucket, so each bubble asks for its own signed link. */
export function MediaBubble({ path, mime, filename, openLabel }: { path: string; mime: string | null; filename: string | null; openLabel: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void whatsAppMediaUrl(path).then((signed) => { if (!cancelled) setUrl(signed); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [path]);
  if (!url) return <div className="mb-1 h-24 w-40 animate-pulse rounded-md bg-muted" />;
  if (mime?.startsWith("image/")) return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={filename ?? ""} className="mb-1 max-h-56 rounded-md object-cover" /></a>;
  if (mime?.startsWith("video/")) return <video src={url} controls className="mb-1 max-h-56 rounded-md" />;
  if (mime?.startsWith("audio/")) return <audio src={url} controls className="mb-1 w-56" />;
  return <a href={url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-md border p-2 text-xs underline"><FileText className="h-4 w-4" />{filename ?? openLabel}</a>;
}
