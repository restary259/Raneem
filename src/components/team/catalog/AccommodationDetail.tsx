import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, MapPin, BedDouble, UtensilsCrossed, Wallet, Footprints, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ImageWithSkeleton from "@/components/ui/image-with-skeleton";
import { useLang } from "@/hooks/useLang";
import {
  type CatalogAccommodation,
  type CatalogSchool,
  formatMoney,
  roomTypeLabel,
  mealsLabel,
  localizedName,
  localizedDescription,
  priceTierOptions,
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
  const [photoIndex, setPhotoIndex] = useState(0);

  // Price tiers — default to the first (entry) tier. Clicking a tier button
  // changes the displayed weekly price.
  const tiers = accommodation ? priceTierOptions(accommodation) : [];
  const [selectedTierKey, setSelectedTierKey] = useState<string>("");

  useEffect(() => {
    if (open) {
      setPhotoIndex(0);
      setSelectedTierKey(tiers[0]?.key ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accommodation?.id]);

  const next = useCallback(() => setPhotoIndex((i) => (i + 1) % Math.max(photos.length, 1)), [photos.length]);
  const prev = useCallback(() => setPhotoIndex((i) => (i - 1 + Math.max(photos.length, 1)) % Math.max(photos.length, 1)), [photos.length]);

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

  const roomType = roomTypeLabel(accommodation.room_type, lang);
  const meals = mealsLabel(accommodation.meals, lang);
  const description = localizedDescription(accommodation, lang);
  const currency = accommodation.currency || "EUR";
  const selectedTier = tiers.find((tr) => tr.key === selectedTierKey) ?? tiers[0];
  const selectedPrice = formatMoney(selectedTier?.price ?? null, currency);
  const hasMultipleTiers = tiers.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0 max-h-[92vh]">
        <DialogTitle className="sr-only">{localizedName(accommodation, lang)}</DialogTitle>
        <div className="max-h-[92vh] overflow-auto">
          {/* Photo gallery on top */}
          <div className="relative bg-black/95 aspect-[4/3] sm:aspect-[16/10]">
            {photos.length > 0 ? (
              <ImageWithSkeleton
                key={photos[photoIndex]}
                src={photos[photoIndex]}
                alt={localizedName(accommodation, lang)}
                className="h-full w-full object-contain"
                skeletonClassName="h-full w-full"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/30">
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
                      onClick={() => setPhotoIndex(i)}
                      aria-label={`${t("catalog.goTo", "Go to")} ${i + 1}`}
                      className={cn(
                        "h-2 rounded-full transition-all",
                        i === photoIndex ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/70",
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Info below the photo */}
          <div className="p-5 sm:p-6 space-y-4">
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

            {/* Price — reflects the selected tier */}
            {selectedPrice && (
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold text-primary">{selectedPrice}</span>
                  <span className="text-base font-medium text-muted-foreground">/ {t("catalog.week", "week")}</span>
                </div>
                {hasMultipleTiers && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("catalog.selectTierHint", "Select a duration to see the weekly price for that tier.")}
                  </p>
                )}
              </div>
            )}

            {/* Tier buttons — clicking changes the displayed price */}
            {hasMultipleTiers && (
              <div className="flex flex-wrap gap-2">
                {tiers.map((tr) => {
                  const tierPrice = formatMoney(tr.price, currency);
                  const active = tr.key === selectedTier?.key;
                  return (
                    <button
                      key={tr.key}
                      type="button"
                      onClick={() => setSelectedTierKey(tr.key)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm transition-colors text-start",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-accent",
                      )}
                    >
                      <span className="block font-medium">{tr.label}</span>
                      {tierPrice && (
                        <span className={cn("block text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          {tierPrice} / {t("catalog.week", "week")}
                        </span>
                      )}
                    </button>
                  );
                })}
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
                  {t("catalog.deposit", "Deposit")}: {formatMoney(accommodation.deposit, currency)}
                </div>
              )}
              {accommodation.placement_fee != null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="h-4 w-4 shrink-0" />
                  {t("catalog.placementFee", "Placement fee")}: {formatMoney(accommodation.placement_fee, currency)}
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
