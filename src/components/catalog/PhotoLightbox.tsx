import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, X, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoLightboxProps {
  photos: string[];
  open: boolean;
  /** Index to open at. */
  startIndex?: number;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

/**
 * The one full-screen photo viewer used by both the Admin and Team catalog.
 * Images are never stretched (object-contain), keyboard + swipe navigable, and
 * only the neighbouring photo is preloaded.
 */
export function PhotoLightbox({
  photos,
  open,
  startIndex = 0,
  title,
  subtitle,
  onClose,
}: PhotoLightboxProps) {
  const { t } = useTranslation("dashboard");
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);
  const count = photos.length;

  useEffect(() => {
    if (open) setIndex(Math.min(Math.max(startIndex, 0), Math.max(count - 1, 0)));
  }, [open, startIndex, count]);

  const next = useCallback(() => setIndex((i) => (count ? (i + 1) % count : 0)), [count]);
  const prev = useCallback(() => setIndex((i) => (count ? (i - 1 + count) % count : 0)), [count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, next, prev, onClose]);

  // Preload only the neighbouring photo.
  useEffect(() => {
    if (!open || count < 2) return;
    const img = new Image();
    img.src = photos[(index + 1) % count];
  }, [open, index, count, photos]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-background/98 backdrop-blur-sm"
      // A parent Radix modal may set pointer-events:none on <body>; re-enable
      // it here so this viewer stays interactive wherever it is opened from.
      style={{ pointerEvents: "auto", touchAction: "pan-y" }}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? t("catalog.photoViewer", "Photo viewer")}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          {title && <h2 className="truncate text-base font-semibold sm:text-lg">{title}</h2>}
          {subtitle && <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {count > 1 && (
            <span className="text-sm tabular-nums text-muted-foreground">
              {(index + 1).toLocaleString("en-US")} / {count.toLocaleString("en-US")}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("catalog.close", "Close")}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center bg-muted/30 p-2 sm:p-6"
        onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start == null || count < 2) return;
          const delta = (e.changedTouches[0]?.clientX ?? start) - start;
          if (Math.abs(delta) < 45) return;
          if (delta < 0) next(); else prev();
        }}
      >
        {count > 0 ? (
          <img
            key={photos[index]}
            src={photos[index]}
            alt={title ?? ""}
            className="max-h-full max-w-full object-contain"
            decoding="async"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
            <ImageOff className="h-16 w-16" />
            <span className="text-sm">{t("catalog.noPhotos", "No photos available")}</span>
          </div>
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label={t("catalog.previous", "Previous")}
              className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full border border-border bg-card/90 p-2.5 text-foreground shadow-sm transition-colors hover:bg-accent sm:start-6"
            >
              <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label={t("catalog.next", "Next")}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full border border-border bg-card/90 p-2.5 text-foreground shadow-sm transition-colors hover:bg-accent sm:end-6"
            >
              <ChevronRight className="h-6 w-6 rtl:rotate-180" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {count > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-border px-4 py-3 sm:px-6">
          {photos.map((p, i) => (
            <button
              key={`${p}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${t("catalog.goTo", "Go to")} ${(i + 1).toLocaleString("en-US")}`}
              aria-current={i === index}
              className={cn(
                "h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition-colors sm:h-16 sm:w-24",
                i === index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              <img src={p} alt="" aria-hidden className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

export default PhotoLightbox;
