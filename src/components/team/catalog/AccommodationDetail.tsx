import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, MapPin, BedDouble, UtensilsCrossed, Wallet, Footprints, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ImageWithSkeleton from "@/components/ui/image-with-skeleton";
import { useLang } from "@/hooks/useLang";
import {
  type CatalogAccommodation,
  type CatalogSchool,
  formatWeeklyPrice,
  roomTypeLabel,
  mealsLabel,
  localizedName,
  localizedDescription,
  weeklyPriceRange,
  CURRENCY_SYMBOLS,
} from "@/lib/catalogDisplay";

interface AccommodationDetailProps {
  accommodation: CatalogAccommodation | null;
  school: CatalogSchool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccommodationDetail({ accommodation, school, open, onOpenChange }: AccommodationDetailProps) {
  const { t } = useTranslation("dashboard");
  const lang = useLang();
  const photos = accommodation?.photos?.filter((p) => p && p.trim()) ?? [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open, accommodation?.id]);

  const next = useCallback(() => setIndex((i) => (i + 1) % Math.max(photos.length, 1)), [photos.length]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + Math.max(photos.length, 1)) % Math.max(photos.length, 1)), [photos.length]);

  useEffect(() => {
    if (!open || photos.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length, next, prev]);

  if (!accommodation) return null;

  const price = formatWeeklyPrice(accommodation, lang);
  const range = weeklyPriceRange(accommodation);
  const showFrom = range && range[0] !== range[1];
  const currency = accommodation.currency || "EUR";
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const roomType = roomTypeLabel(accommodation.room_type, lang);
  const meals = mealsLabel(accommodation.meals, lang);
  const description = localizedDescription(accommodation, lang);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 max-h-[92vh]">
        <DialogTitle className="sr-only">{localizedName(accommodation, lang)}</DialogTitle>
        <div className="grid md:grid-cols-2 max-h-[92vh] overflow-auto">
          {/* Gallery */}
          <div className="relative bg-black/95 aspect-[4/3] md:aspect-auto md:min-h-[420px]">
            {photos.length > 0 ? (
              <ImageWithSkeleton
                key={photos[index]}
                src={photos[index]}
                alt={localizedName(accommodation, lang)}
                className="h-full w-full object-contain"
                skeletonClassName="h-full w-full"
              />
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center text-muted-foreground/30">
                <BedDouble className="h-20 w-20" />
              </div>
            )}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  aria-label={t("catalog.previous", "Previous")}
                  className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  aria-label={t("catalog.next", "Next")}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="h-6 w-6 rtl:rotate-180" />
                </button>
                <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
                  {photos.map((p, i) => (
                    <button
                      key={`${p}-${i}`}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`${t("catalog.goTo", "Go to")} ${i + 1}`}
                      className={cn(
                        "h-2 rounded-full transition-all",
                        i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/70",
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold leading-tight">{localizedName(accommodation, lang)}</h2>
                {school && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {localizedName(school, lang)}
                    {school.city ? ` · ${school.city}` : ""}
                  </p>
                )}
              </div>
            </div>

            {price && (
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
                <div className="flex items-baseline gap-1.5">
                  {showFrom && (
                    <span className="text-sm font-medium text-muted-foreground">
                      {t("catalog.from", "from")}
                    </span>
                  )}
                  <span className="text-4xl font-bold text-primary">{price}</span>
                  <span className="text-base font-medium text-muted-foreground">/ {t("catalog.week", "week")}</span>
                </div>
                {range && range[0] !== range[1] && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {symbol}{range[0].toLocaleString()} – {symbol}{range[1].toLocaleString()} {t("catalog.perWeekRange", "per week depending on duration")}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {roomType && (
                <Badge variant="secondary">
                  <BedDouble className="me-1.5 h-3.5 w-3.5" />
                  {roomType}
                </Badge>
              )}
              {meals && (
                <Badge variant="secondary">
                  <UtensilsCrossed className="me-1.5 h-3.5 w-3.5" />
                  {meals}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {accommodation.distance_note && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Footprints className="h-4 w-4 shrink-0" />
                  {accommodation.distance_note}
                </div>
              )}
              {accommodation.deposit != null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="h-4 w-4 shrink-0" />
                  {t("catalog.deposit", "Deposit")}: {symbol}{accommodation.deposit.toLocaleString()}
                </div>
              )}
              {accommodation.placement_fee != null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="h-4 w-4 shrink-0" />
                  {t("catalog.placementFee", "Placement fee")}: {symbol}{accommodation.placement_fee.toLocaleString()}
                </div>
              )}
              {school?.website && (
                <a
                  href={school.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Globe className="h-4 w-4 shrink-0" />
                  {t("catalog.schoolWebsite", "School website")}
                </a>
              )}
            </div>

            {description && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{description}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
