import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, ExternalLink, FileSpreadsheet, FileText, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatFileSize,
  isImageAttachment,
  isPdfAttachment,
  type ChatAttachment,
} from "@/lib/chatFormat";
import { getAttachmentUrl, openAttachment } from "@/services/ChatAttachmentService";

function iconFor(att: ChatAttachment) {
  if (isImageAttachment(att)) return ImageIcon;
  if (att.mime.includes("sheet") || att.mime.includes("excel")) return FileSpreadsheet;
  return FileText;
}

/** Inline image thumbnail / PDF chip with an in-app viewer dialog. */
export default function AttachmentPreview({
  att,
  className,
}: {
  att: ChatAttachment;
  className?: string;
}) {
  const { t } = useTranslation("dashboard");
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const Icon = iconFor(att);
  const previewable = isImageAttachment(att) || isPdfAttachment(att);

  useEffect(() => {
    let active = true;
    if (!isImageAttachment(att)) return;
    getAttachmentUrl(att.path)
      .then((u) => active && setThumb(u))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [att]);

  const openViewer = async () => {
    if (!previewable) {
      await openAttachment(att.path);
      return;
    }
    setOpen(true);
    if (!url) {
      try {
        setUrl(await getAttachmentUrl(att.path, 900));
      } catch {
        setFailed(true);
      }
    }
  };

  if (isImageAttachment(att) && thumb && !failed) {
    return (
      <>
        <button
          type="button"
          onClick={openViewer}
          className={cn(
            "group relative block overflow-hidden rounded-lg border bg-muted/30",
            className,
          )}
          title={att.name}
        >
          <img
            src={thumb}
            alt={att.name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-32 w-44 object-cover transition-transform group-hover:scale-[1.03]"
          />
          <span className="absolute inset-x-0 bottom-0 truncate bg-foreground/60 px-2 py-1 text-[11px] text-background">
            {att.name} · {formatFileSize(att.size)}
          </span>
        </button>
        <Viewer att={att} open={open} setOpen={setOpen} url={url} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openViewer}
        title={att.name}
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-background/80 px-2.5 py-2 text-start transition-colors hover:bg-accent",
          className,
        )}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="max-w-[180px] truncate text-xs font-medium">{att.name}</span>
        <span className="text-[11px] text-muted-foreground">{formatFileSize(att.size)}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="sr-only">{t("chat.openAttachment")}</span>
      </button>
      <Viewer att={att} open={open} setOpen={setOpen} url={url} />
    </>
  );
}

function Viewer({
  att,
  open,
  setOpen,
  url,
}: {
  att: ChatAttachment;
  open: boolean;
  setOpen: (v: boolean) => void;
  url: string | null;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate text-sm">{att.name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-auto rounded-md border bg-muted/20">
          {!url ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {t("chat.attach.loading")}
            </div>
          ) : isImageAttachment(att) ? (
            <img src={url} alt={att.name} className="mx-auto max-h-[68vh] object-contain" />
          ) : (
            <iframe title={att.name} src={url} className="h-[68vh] w-full" />
          )}
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => openAttachment(att.path)}
          >
            <Download className="h-4 w-4" />
            {t("chat.attach.download")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
