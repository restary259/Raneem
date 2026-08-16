import { useTranslation } from "react-i18next";
import { MapPin, BedDouble, UtensilsCrossed, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import ImageWithSkeleton from "@/components/ui/image-with-skeleton";
import { useLang } from "@/hooks/useLang";
import {
  type CatalogAccommodation,
  type CatalogSchool,
  formatWeeklyPrice,
  roomTypeLabel,
  mealsLabel,
  primaryPhoto,
  localizedName,
  weeklyPriceRange,
} from "@/lib/catalogDisplay";

interface AccommodationCardProps {
  accommodation: CatalogAccommodation;
  school: CatalogSchool | null;
  /** Bigger card for large screens / presentation preview. */
  size?: "default" | "large";
  onSelect: (accommodation: CatalogAccommodation) => void;
}

export function AccommodationCard({
  accommodation,
  school,
  size = "default",
  onSelect,
}: AccommodationCardProps) {
  const { t } = useTranslation("dashboard");
  const lang = useLang();
  const photo = primaryPhoto(accommodation.photos);
  const price = formatWeeklyPrice(accommodation, lang);
  const range = weeklyPriceRange(accommodation);
  const showFrom = range && range[0] !== range[1];
  const roomType = roomTypeLabel(accommodation.room_type, lang);
  const meals = mealsLabel(accommodation.meals, lang);

  const imageHeight = size === "large" ? "h-64 sm:h-80" : "h-44 sm:h-52";

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${localizedName(accommodation, lang)}${price ? `, ${price}` : ""}`}
      onClick={() => onSelect(accommodation)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(accommodation);
        }
      }}
      className={cn(
        "group overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        !accommodation.is_active && "opacity-60",
      )}
    >
      <div className={cn("relative w-full overflow-hidden bg-muted", imageHeight)}>
        {photo ? (
          <ImageWithSkeleton
            src={photo}
            alt={localizedName(accommodation, lang)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            skeletonClassName={cn(imageHeight, "rounded-none")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
            <BedDouble className={size === "large" ? "h-16 w-16" : "h-10 w-10"} />
          </div>
        )}
        {price && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3 sm:p-4">
            <div className="flex items-baseline gap-1.5">
              {showFrom && (
                <span className="text-xs font-medium text-white/80">
                  {t("catalog.from", "from")}
                </span>
              )}
              <span className={cn("font-bold text-white", size === "large" ? "text-3xl" : "text-2xl")}>
                {price}
              </span>
              <span className="text-sm font-medium text-white/80">/ {t("catalog.week", "week")}</span>
            </div>
          </div>
        )}
      </div>

      <div className={cn("space-y-2", size === "large" ? "p-5" : "p-4")}>
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn("font-semibold leading-tight", size === "large" ? "text-xl" : "text-base")}>
            {localizedName(accommodation, lang)}
          </h3>
          <ArrowRight
            className={cn(
              "shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1",
              size === "large" ? "h-5 w-5" : "h-4 w-4",
            )}
          />
        </div>

        {school && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {localizedName(school, lang)}
              {school.city ? ` · ${school.city}` : ""}
            </span>
          </p>
        )}

        {(roomType || meals) && (
          <div className="flex flex-wrap gap-1.5">
            {roomType && (
              <Badge variant="secondary" className="font-normal">
                <BedDouble className="me-1 h-3 w-3" />
                {roomType}
              </Badge>
            )}
            {meals && (
              <Badge variant="secondary" className="font-normal">
                <UtensilsCrossed className="me-1 h-3 w-3" />
                {meals}
              </Badge>
            )}
            {accommodation.distance_note && size === "large" && (
              <Badge variant="outline" className="font-normal">
                {accommodation.distance_note}
              </Badge>
            )}
          </div>
        )}

        {size === "default" && accommodation.distance_note && (
          <p className="text-xs text-muted-foreground">{accommodation.distance_note}</p>
        )}
      </div>
    </Card>
  );
}
