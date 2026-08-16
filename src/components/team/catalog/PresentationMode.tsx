import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Play, Pause, X, MapPin, BedDouble, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLang } from "@/hooks/useLang";
import {
  type SchoolGroup,
  type CatalogAccommodation,
  formatWeeklyPrice,
  roomTypeLabel,
  mealsLabel,
  localizedName,
  localizedDescription,
  primaryPhoto,
} from "@/lib/catalogDisplay";

interface PresentationModeProps {
  groups: SchoolGroup[];
  onExit: () => void;
}

const SLIDE_SECONDS = [5, 10, 15] as const;

/** Flat ordered slide list: school → accommodation → accommodation → next school. */
interface Slide {
  group: SchoolGroup;
  accommodation: CatalogAccommodation;
}

function buildSlides(groups: SchoolGroup[]): Slide[] {
  const slides: Slide[] = [];
  for (const group of groups) {
    for (const accommodation of group.accommodations) {
      slides.push({ group, accommodation });
    }
  }
  return slides;
}

export function PresentationMode({ groups, onExit }: PresentationModeProps) {
  const { t } = useTranslation("dashboard");
  const lang = useLang();

  const slides = useMemo(() => buildSlides(groups), [groups]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [seconds, setSeconds] = useState<number>(10);
  const [imgLoaded, setImgLoaded] = useState(false);

  const slide = slides[index] ?? null;

  const goNext = useCallback(() => {
    setImgLoaded(false);
    setIndex((i) => (slides.length ? (i + 1) % slides.length : 0));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setImgLoaded(false);
    setIndex((i) => (slides.length ? (i - 1 + slides.length) % slides.length : 0));
  }, [slides.length]);

  // Single interval, re-armed only when (playing, seconds, slide count) change.
  useEffect(() => {
    if (!playing || slides.length === 0) return;
    const ms = seconds * 1000;
    const id = window.setInterval(goNext, ms);
    return () => window.clearInterval(id);
  }, [playing, seconds, slides.length, goNext]);

  // Keyboard controls (presentation mode has no text inputs to protect).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === "Escape") { e.preventDefault(); onExit(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onExit]);

  // Lock body scroll while the overlay is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Preload the next slide's image for a smooth transition.
  useEffect(() => {
    if (!slides.length) return;
    const next = slides[(index + 1) % slides.length];
    const photo = primaryPhoto(next.accommodation.photos);
    if (photo) {
      const img = new Image();
      img.src = photo;
    }
  }, [index, slides]);

  if (slides.length === 0 || !slide) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background text-foreground">
        <p className="text-2xl text-muted-foreground">{t("catalog.noAccommodations", "No accommodations to display")}</p>
        <Button variant="outline" size="lg" className="mt-6" onClick={onExit}>
          <X className="me-2 h-5 w-5" />
          {t("catalog.exitPresentation", "Exit presentation")}
        </Button>
      </div>,
      document.body,
    );
  }

  const { group, accommodation } = slide;
  const photo = primaryPhoto(accommodation.photos);
  const price = formatWeeklyPrice(accommodation, lang);
  const roomType = roomTypeLabel(accommodation.room_type, lang);
  const meals = mealsLabel(accommodation.meals, lang);
  const description = localizedDescription(accommodation, lang);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-background text-foreground" role="dialog" aria-modal="true" aria-label={t("catalog.presentationMode", "Presentation mode")}>
      {/* Image stage */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {photo ? (
          <img
            key={photo}
            src={photo}
            alt={localizedName(accommodation, lang)}
            onLoad={() => setImgLoaded(true)}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              imgLoaded ? "opacity-100" : "opacity-0",
            )}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
            <BedDouble className="h-32 w-32" />
          </div>
        )}
        {/* Dark gradient overlay for legibility on a TV */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/30 pointer-events-none" />

        {/* Prev / Next large hit areas */}
        <button
          type="button"
          onClick={goPrev}
          aria-label={t("catalog.previous", "Previous")}
          className="absolute start-0 top-0 bottom-0 w-1/4 flex items-center justify-start p-4 group"
        >
          <span className="rounded-full bg-white/15 backdrop-blur p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft className="h-8 w-8 rtl:rotate-180" />
          </span>
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label={t("catalog.next", "Next")}
          className="absolute end-0 top-0 bottom-0 w-1/4 flex items-center justify-end p-4 group"
        >
          <span className="rounded-full bg-white/15 backdrop-blur p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="h-8 w-8 rtl:rotate-180" />
          </span>
        </button>

        {/* Info overlay — TV-safe hierarchy */}
        <div className="absolute bottom-0 inset-x-0 p-6 sm:p-10 lg:p-14 text-white">
          {group.isOther !== true && (
            <div className="flex items-center gap-2 mb-2 text-white/80">
              <MapPin className="h-5 w-5 lg:h-6 lg:w-6" />
              <span className="text-lg lg:text-2xl font-medium">
                {localizedName(group.school, lang)}
                {group.school.city ? ` · ${group.school.city}` : ""}
              </span>
            </div>
          )}
          <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight drop-shadow-lg max-w-5xl">
            {localizedName(accommodation, lang)}
          </h2>
          {price && (
            <p className="mt-3 lg:mt-4 text-3xl sm:text-4xl lg:text-6xl font-bold text-amber-300 drop-shadow-lg">
              {price}
              <span className="ms-2 text-xl lg:text-3xl font-medium text-white/80">/ {t("catalog.week", "week")}</span>
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 lg:gap-3">
            {roomType && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-lg lg:text-2xl">
                <BedDouble className="h-5 w-5 lg:h-6 lg:w-6" />
                {roomType}
              </span>
            )}
            {meals && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-lg lg:text-2xl">
                <UtensilsCrossed className="h-5 w-5 lg:h-6 lg:w-6" />
                {meals}
              </span>
            )}
            {accommodation.distance_note && (
              <span className="inline-flex items-center rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-lg lg:text-2xl">
                {accommodation.distance_note}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-4 max-w-3xl text-base lg:text-xl text-white/85 line-clamp-3 drop-shadow">
              {description}
            </p>
          )}
        </div>

        {/* Slide counter */}
        <div className="absolute top-4 end-6 rounded-full bg-black/50 backdrop-blur px-4 py-1.5 text-white text-base lg:text-lg font-medium">
          {index + 1} / {slides.length}
        </div>
      </div>

      {/* Control bar */}
      <div className="shrink-0 border-t bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={goPrev}
            aria-label={t("catalog.previous", "Previous")}
            className="h-12 w-12 p-0"
          >
            <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
          </Button>
          <Button
            variant={playing ? "secondary" : "default"}
            size="lg"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? t("catalog.pause", "Pause") : t("catalog.play", "Play")}
            className="h-12 px-6"
          >
            {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            <span className="ms-2 hidden sm:inline">{playing ? t("catalog.pause", "Pause") : t("catalog.play", "Play")}</span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={goNext}
            aria-label={t("catalog.next", "Next")}
            className="h-12 w-12 p-0"
          >
            <ChevronRight className="h-6 w-6 rtl:rotate-180" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={String(seconds)} onValueChange={(v) => setSeconds(Number(v))}>
            <SelectTrigger className="w-auto h-12" aria-label={t("catalog.slideDuration", "Slide duration")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLIDE_SECONDS.map((s) => (
                <SelectItem key={s} value={String(s)}>{s}s {t("catalog.perSlide", "/ slide")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="destructive" size="lg" onClick={onExit} className="h-12 px-6">
            <X className="h-6 w-6" />
            <span className="ms-2 hidden sm:inline">{t("catalog.exitPresentation", "Exit presentation")}</span>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
