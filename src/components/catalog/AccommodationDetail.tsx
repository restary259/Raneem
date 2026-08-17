import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, BedDouble, UtensilsCrossed, Wallet, Footprints, Globe, Images } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLang } from "@/hooks/useLang";
import CatalogImage from "./CatalogImage";
import PhotoLightbox from "./PhotoLightbox";
import {
  type CatalogAccommodation,
  type CatalogSchool,
  formatMoney,
  roomTypeLabel,
  mealsLabel,
  localizedName,
  localizedDescription,
  priceTierOptions,
  allPhotos,
} from "@/lib/catalogDisplay";

interface AccommodationDetailProps {
  accommodation: CatalogAccommodation | null;
  school: CatalogSchool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Property-style detail sheet: photo grid on top (any photo opens the shared
 * full-screen lightbox), then the full record and the weekly price ladder.
 */
export function AccommodationDetail({ accommodation, school, open, onOpenChange }: AccommodationDetailProps) {
  const { t } = useTranslation("dashboard");
  const lang = useLang();
  const photos = allPhotos(accommodation?.photos);
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);

  const tiers = accommodation ? priceTierOptions(accommodation) : [];
  const [selectedTierKey, setSelectedTierKey] = useState<string>("");

  useEffect(() => {
    if (open) {
      setSelectedTierKey(tiers[0]?.key ?? "");
      setLightboxAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accommodation?.id]);

  if (!accommodation) return null;

  const roomType = roomTypeLabel(accommodation.room_type, lang);
  const meals = mealsLabel(accommodation.meals, lang);
  const description = localizedDescription(accommodation, lang);
  const currency = accommodation.currency || "EUR";
  const selectedTier = tiers.find((tr) => tr.key === selectedTierKey) ?? tiers[0];
  const selectedPrice = formatMoney(selectedTier?.price ?? null, currency);
  const hasMultipleTiers = tiers.length > 1;
  const name = localizedName(accommodation, lang);
  const schoolLine = school
    ? `${localizedName(school, lang)}${school.city ? ` · ${school.city}` : ""}`
    : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-4xl gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">{name}</DialogTitle>
          <div className="max-h-[92vh] overflow-auto">
            {/* Photo grid — click any photo for the full-screen viewer */}
            <div className="relative">
              {photos.length > 0 ? (
                <div className={cn("grid gap-1", photos.length > 1 ? "grid-cols-3" : "grid-cols-1")}>
                  <button
                    type="button"
                    onClick={() => setLightboxAt(0)}
                    className={cn("group text-start", photos.length > 1 && "col-span-2 row-span-2")}
                    aria-label={t("catalog.viewPhotos", "View photos")}
                  >
                    <CatalogImage
                      src={photos[0]}
                      alt={name}
                      aspect={photos.length > 1 ? "aspect-[4/3]" : "aspect-[16/9]"}
                      icon={BedDouble}
                      className="[&_img]:group-hover:scale-105"
                    />
                  </button>
                  {photos.slice(1, 3).map((p, i) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setLightboxAt(i + 1)}
                      className="group relative text-start"
                      aria-label={t("catalog.viewPhotos", "View photos")}
                    >
                      <CatalogImage
                        src={p}
                        alt={name}
                        aspect="aspect-[4/3]"
                        icon={BedDouble}
                        className="[&_img]:group-hover:scale-105"
                      />
                      {i === 1 && photos.length > 3 && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">
                          +{(photos.length - 3).toLocaleString("en-US")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <CatalogImage src={null} alt={name} aspect="aspect-[16/9]" icon={BedDouble} />
              )}

              {photos.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setLightboxAt(0)}
                  className="absolute bottom-3 end-3 shadow-sm"
                >
                  <Images className="me-1.5 h-4 w-4" />
                  {t("catalog.viewAllPhotos", "View all photos")} ({photos.length.toLocaleString("en-US")})
                </Button>
              )}
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold leading-tight">{name}</h2>
                {schoolLine && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {schoolLine}
                  </p>
                )}
              </div>

              {selectedPrice && (
                <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
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
                          "rounded-lg border px-3 py-2 text-start text-sm transition-colors",
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

              {(roomType || meals) && (
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
              )}

              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
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
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PhotoLightbox
        photos={photos}
        open={lightboxAt !== null}
        startIndex={lightboxAt ?? 0}
        title={name}
        subtitle={schoolLine}
        onClose={() => setLightboxAt(null)}
      />
    </>
  );
}

export default AccommodationDetail;
