import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MonitorPlay, RefreshCw, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState, ErrorState } from "@/components/shell";
import { useTeamCatalog } from "@/hooks/useTeamCatalog";
import {
  distinctCities,
  filterCatalog,
  type CatalogAccommodation,
} from "@/lib/catalogDisplay";
import { CatalogFilters, type CatalogFilterValues } from "@/components/team/catalog/CatalogFilters";
import { SchoolCatalogSection } from "@/components/team/catalog/SchoolCatalogSection";
import { AccommodationDetail } from "@/components/team/catalog/AccommodationDetail";
import { PresentationMode } from "@/components/team/catalog/PresentationMode";

const EMPTY_FILTERS: CatalogFilterValues = { search: "", city: "", schoolId: "", roomType: "" };

export default function TeamCatalogPage() {
  const { t } = useTranslation("dashboard");
  const { data, loading, error, refetch } = useTeamCatalog();
  const [filters, setFilters] = useState<CatalogFilterValues>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<CatalogAccommodation | null>(null);
  const [presentation, setPresentation] = useState(false);

  const cities = useMemo(() => (data ? distinctCities(data.schools) : []), [data]);

  // room_type values actually present, for the filter dropdown.
  const roomTypes = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const a of data.accommodations) if (a.room_type) set.add(a.room_type);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    return filterCatalog(data.schools, data.accommodations, filters);
  }, [data, filters]);

  const totalAccommodations = filteredGroups.reduce((n, g) => n + g.accommodations.length, 0);

  const selectedSchool = useMemo(() => {
    if (!data || !selected) return null;
    return data.schools.find((s) => s.id === selected.school_id) ?? null;
  }, [data, selected]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.catalog", "Catalog")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("catalog.pageDesc", "Browse schools and accommodations. Switch to presentation mode for the office TV.")}
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => setPresentation(true)}
          disabled={loading || !!error || totalAccommodations === 0}
          className="shrink-0"
        >
          <MonitorPlay className="me-2 h-5 w-5" />
          {t("catalog.presentationMode", "Presentation mode")}
        </Button>
      </div>

      {/* Body */}
      {loading ? (
        <LoadingState variant="cards" rows={6} />
      ) : error ? (
        <ErrorState
          title={t("catalog.loadError", "Couldn't load the catalog")}
          description={t("catalog.loadErrorDesc", "Please try again. If the problem persists, contact an administrator.")}
          onRetry={refetch}
          retryLabel={t("catalog.retry", "Retry")}
        />
      ) : !data || data.schools.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("catalog.noSchools", "No schools available")}
          description={t("catalog.noSchoolsDesc", "Catalog entries are managed by administrators.")}
        />
      ) : (
        <>
          <CatalogFilters
            schools={data.schools}
            roomTypes={roomTypes}
            values={filters}
            onChange={setFilters}
          />

          {totalAccommodations === 0 ? (
            <EmptyState
              icon={Building2}
              title={t("catalog.noMatches", "No accommodations match your filters")}
              description={t("catalog.noMatchesDesc", "Try clearing some filters to see more options.")}
              action={
                <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                  <RefreshCw className="me-1.5 h-3.5 w-3.5" />
                  {t("catalog.clearFilters", "Clear filters")}
                </Button>
              }
            />
          ) : (
            <div className="space-y-8">
              {filteredGroups.map((group) => (
                <SchoolCatalogSection key={group.school.id} group={group} onSelect={setSelected} />
              ))}
            </div>
          )}
        </>
      )}

      <AccommodationDetail
        accommodation={selected}
        school={selectedSchool}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />

      {presentation && filteredGroups.length > 0 && (
        <PresentationMode groups={filteredGroups} onExit={() => setPresentation(false)} />
      )}
    </div>
  );
}
