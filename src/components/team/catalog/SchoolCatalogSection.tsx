import { Building2, MapPin } from "lucide-react";
import { AccommodationCard } from "./AccommodationCard";
import { type SchoolGroup, type CatalogAccommodation, localizedName, localizedDescription, primaryPhoto } from "@/lib/catalogDisplay";
import { useLang } from "@/hooks/useLang";

interface SchoolCatalogSectionProps {
  group: SchoolGroup;
  onSelect: (accommodation: CatalogAccommodation) => void;
}

export function SchoolCatalogSection({ group, onSelect }: SchoolCatalogSectionProps) {
  const lang = useLang();
  const { school, accommodations } = group;
  const photo = primaryPhoto(school.photos);
  const description = localizedDescription(school, lang);
  const isOther = group.isOther === true;

  return (
    <section className="space-y-4 scroll-mt-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b pb-3">
        {photo && !isOther && (
          <img
            src={photo}
            alt=""
            aria-hidden
            className="h-14 w-14 rounded-lg object-cover border shrink-0"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 shrink-0 text-primary" />
            <h2 className="text-xl font-bold tracking-tight truncate">{localizedName(school, lang)}</h2>
            <span className="text-sm text-muted-foreground">({accommodations.length})</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
            {school.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {school.city}
                {school.country ? `, ${school.country}` : ""}
              </span>
            )}
            {description && (
              <span className="truncate hidden sm:inline">{description}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {accommodations.map((a) => (
          <AccommodationCard
            key={a.id}
            accommodation={a}
            school={school}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
