import { useTranslation } from "react-i18next";
import { MapPin, BedDouble, UtensilsCrossed, Images, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLang } from "@/hooks/useLang";
import CatalogImage from "./CatalogImage";
import {
  type CatalogAccommodation,
  type CatalogSchool,
  formatWeeklyPrice,
  roomTypeLabel,
  mealsLabel,
  primaryPhoto,
  photoCount,
  localizedName,
  weeklyPriceRange,
} from "@/lib/catalogDisplay";

interface AccommodationCardProps {
  accommodation: CatalogAccommodation;
  school: CatalogSchool | null;
  /** Bigger card for the school detail / presentation grid. */
  size?: "default" | "large";
  showSchool?: boolean;
  onSelect: (accommodation: CatalogAccommodation) => void;
}

export function AccommodationCard({
  accommodation,
  school,
  size = "default",
  showSchool = true,
  onSelect,
}: AccommodationCardProps) {
  const { t } = useTranslation("dashboard");
  const lang = useLang();
  const photo = primaryPhoto(accommodation.photos);
  const photos = photoCount(accommodation.photos);
  const price = formatWeeklyPrice(accommodation);
  const range = weeklyPriceRange(accommodation);
  const showFrom = range && range[0] !== range[1];
  const roomType = roomTypeLabel(accommodation.room_type, lang);
  const meals = mealsLabel(accommodation.meals, lang);

  const aspect = size === "large" ? "aspect-[16/10] xl:aspect-[16/9]" : "aspect-[4/3]";

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
        "group cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        !accommodation.is_active && "opacity-60",
      )}
    >
      <div className="relative">
        <CatalogImage
          src={photo}
          alt={localizedName(accommodation, lang)}
          aspect={aspect}
          icon={BedDouble}
          className="[&_img]:group-hover:scale-105"
        />

        {photos > 1 && (
          <span className="pointer-events-none absolute end-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
            <Images className="h-3.5 w-3.5" />
            {photos.toLocaleString("en-US")}
          </span>
        )}

        {price && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 sm:p-4">
            <div className="flex items-baseline gap-1.5">
              {showFrom && <span className="text-xs font-medium text-white/80">{t("catalog.from", "from")}</span>}
              <span className={cn("font-bold text-white", size === "large" ? "text-3xl xl:text-4xl" : "text-2xl")}>
                {price}
              </span>
              <span className="text-sm font-medium text-white/80">/ {t("catalog.week", "week")}</span>
            </div>
          </div>
        )}
      </div>

      <div className={cn("space-y-2", size === "large" ? "p-5" : "p-4")}>
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn("font-semibold leading-tight", size === "large" ? "text-lg xl:text-xl" : "text-base")}>
            {localizedName(accommodation, lang)}
          </h3>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
        </div>

        {showSchool && school && (
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
          </div>
        )}

        {accommodation.distance_note && (
          <p className="text-xs text-muted-foreground">{accommodation.distance_note}</p>
        )}
      </div>
    </Card>
  );
}

export default AccommodationCard;
