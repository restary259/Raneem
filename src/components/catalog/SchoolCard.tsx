import { useTranslation } from "react-i18next";
import { Building2, MapPin, ArrowRight, GraduationCap, BedDouble } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLang } from "@/hooks/useLang";
import CatalogImage from "./CatalogImage";
import { type CatalogSchool, localizedName, localizedDescription, primaryPhoto } from "@/lib/catalogDisplay";

interface SchoolCardProps {
  school: CatalogSchool;
  programCount: number;
  accommodationCount: number;
  onSelect: (school: CatalogSchool) => void;
}

export function SchoolCard({ school, programCount, accommodationCount, onSelect }: SchoolCardProps) {
  const { t } = useTranslation("dashboard");
  const lang = useLang();
  const description = localizedDescription(school, lang);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(school)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(school);
        }
      }}
      aria-label={localizedName(school, lang)}
      className={cn(
        "group cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        !school.is_active && "opacity-60",
      )}
    >
      <CatalogImage
        src={primaryPhoto(school.photos)}
        alt={localizedName(school, lang)}
        aspect="aspect-[16/10] xl:aspect-[16/9]"
        icon={Building2}
        className="[&_img]:group-hover:scale-105"
      />

      <div className="space-y-2 p-4 xl:p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-tight xl:text-lg">{localizedName(school, lang)}</h3>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
        </div>

        {(school.city || school.country) && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {school.city}
              {school.city && school.country ? ", " : ""}
              {school.country}
            </span>
          </p>
        )}

        {description && <p className="line-clamp-2 text-xs text-muted-foreground xl:text-sm">{description}</p>}

        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <Badge variant="secondary" className="font-normal">
            <GraduationCap className="me-1 h-3 w-3" />
            {programCount.toLocaleString("en-US")} {t("catalog.programs", "programs")}
          </Badge>
          <Badge variant="secondary" className="font-normal">
            <BedDouble className="me-1 h-3 w-3" />
            {accommodationCount.toLocaleString("en-US")} {t("catalog.accommodations", "accommodations")}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

export default SchoolCard;
