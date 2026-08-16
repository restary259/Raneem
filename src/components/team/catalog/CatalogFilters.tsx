import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type CatalogSchool, type CatalogFilter, distinctCities, localizedName, roomTypeLabel } from "@/lib/catalogDisplay";
import { useLang } from "@/hooks/useLang";

export type CatalogFilterValues = CatalogFilter;

interface CatalogFiltersProps {
  schools: CatalogSchool[];
  /** room_type values present in the accommodations, deduped + sorted. */
  roomTypes: string[];
  values: CatalogFilterValues;
  onChange: (values: CatalogFilterValues) => void;
}

const ALL = "__all__";

export function CatalogFilters({ schools, roomTypes, values, onChange }: CatalogFiltersProps) {
  const { t } = useTranslation("dashboard");
  const lang = useLang();
  const cities = distinctCities(schools);
  const [searchInput, setSearchInput] = useState(values.search);

  // Debounce the search box so typing doesn't refilter on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== values.search) onChange({ ...values, search: searchInput });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const hasActiveFilters = values.city || values.schoolId || values.roomType || values.search;

  const clearAll = () => {
    setSearchInput("");
    onChange({ search: "", city: "", schoolId: "", roomType: "" });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("catalog.searchPlaceholder", "Search accommodations or schools…")}
          className="ps-9"
          aria-label={t("catalog.searchPlaceholder", "Search accommodations or schools…")}
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput("")}
            aria-label={t("catalog.clearSearch", "Clear search")}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Select
          value={values.city || ALL}
          onValueChange={(v) => onChange({ ...values, city: v === ALL ? "" : v, schoolId: "" })}
        >
          <SelectTrigger aria-label={t("catalog.filterCity", "City")}>
            <SelectValue placeholder={t("catalog.filterCity", "City")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("catalog.allCities", "All cities")}</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={values.schoolId || ALL}
          onValueChange={(v) => onChange({ ...values, schoolId: v === ALL ? "" : v })}
        >
          <SelectTrigger aria-label={t("catalog.filterSchool", "School")}>
            <SelectValue placeholder={t("catalog.filterSchool", "School")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("catalog.allSchools", "All schools")}</SelectItem>
            {schools.map((s) => (
              <SelectItem key={s.id} value={s.id}>{localizedName(s, lang)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={values.roomType || ALL}
          onValueChange={(v) => onChange({ ...values, roomType: v === ALL ? "" : v })}
        >
          <SelectTrigger aria-label={t("catalog.filterRoomType", "Room type")}>
            <SelectValue placeholder={t("catalog.filterRoomType", "Room type")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("catalog.allTypes", "All types")}</SelectItem>
            {roomTypes.map((r) => (
              <SelectItem key={r} value={r}>{roomTypeLabel(r, lang)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="me-1.5 h-3.5 w-3.5" />
            {t("catalog.clearFilters", "Clear filters")}
          </Button>
        </div>
      )}
    </div>
  );
}
