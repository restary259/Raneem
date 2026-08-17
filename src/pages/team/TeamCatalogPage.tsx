import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Building2, Globe2, GraduationCap, BedDouble, ArrowLeft, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadingState, ErrorState } from "@/components/shell";
import { useTeamCatalog } from "@/hooks/useTeamCatalog";
import { useLang } from "@/hooks/useLang";
import {
  distinctCities,
  groupByCountry,
  filterSchools,
  schoolStats,
  allPhotos,
  localizedName,
  localizedDescription,
  primaryPhoto,
  type CatalogAccommodation,
  type CatalogSchool,
  type CatalogProgram,
} from "@/lib/catalogDisplay";
import {
  CatalogBreadcrumb,
  SchoolCard,
  ProgramCard,
  AccommodationCard,
  AccommodationDetail,
  PhotoLightbox,
  CatalogImage,
} from "@/components/catalog";
import { CatalogFilters, type CatalogFilterValues } from "@/components/team/catalog/CatalogFilters";

const EMPTY_FILTERS: CatalogFilterValues = { search: "", city: "", schoolId: "", roomType: "" };

type SchoolTab = "programs" | "accommodations";

export default function TeamCatalogPage() {
  const { t } = useTranslation("dashboard");
  const lang = useLang();
  const { data, loading, error, refetch } = useTeamCatalog();

  const [filters, setFilters] = useState<CatalogFilterValues>(EMPTY_FILTERS);
  const [country, setCountry] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [tab, setTab] = useState<SchoolTab>("accommodations");
  const [selected, setSelected] = useState<CatalogAccommodation | null>(null);
  const [schoolPhotosOpen, setSchoolPhotosOpen] = useState(false);
  const [programPhotos, setProgramPhotos] = useState<CatalogProgram | null>(null);

  const countries = useMemo(() => (data ? groupByCountry(data.schools) : []), [data]);

  // With a single country in the catalog, skip the selection step entirely.
  const activeCountry = country ?? (countries.length === 1 ? countries[0].country : null);

  const countryLabel = (value: string) => value || t("catalog.otherCountry", "Other");

  const roomTypes = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const a of data.accommodations) if (a.room_type) set.add(a.room_type);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const countrySchools = useMemo(() => {
    if (!data) return [];
    if (activeCountry == null) return data.schools;
    return data.schools.filter((s) => (s.country?.trim() || "") === activeCountry);
  }, [data, activeCountry]);

  const visibleSchools = useMemo(() => {
    if (!data) return [];
    return filterSchools(countrySchools, data.programs, data.accommodations, {
      search: filters.search,
      city: filters.city,
    }).filter((s) => !filters.schoolId || s.id === filters.schoolId);
  }, [data, countrySchools, filters]);

  const school: CatalogSchool | null = useMemo(
    () => (data && schoolId ? data.schools.find((s) => s.id === schoolId) ?? null : null),
    [data, schoolId],
  );

  const schoolPrograms = useMemo(
    () => (data && school ? data.programs.filter((p) => p.school_id === school.id) : []),
    [data, school],
  );

  const schoolAccommodations = useMemo(() => {
    if (!data || !school) return [];
    return data.accommodations.filter(
      (a) => a.school_id === school.id && (!filters.roomType || a.room_type === filters.roomType),
    );
  }, [data, school, filters.roomType]);

  const selectedSchool = useMemo(() => {
    if (!data || !selected) return null;
    return data.schools.find((s) => s.id === selected.school_id) ?? null;
  }, [data, selected]);

  const crumbs = useMemo(() => {
    const items = [
      {
        label: t("catalog.allCountries", "Catalog"),
        onClick: () => { setCountry(null); setSchoolId(null); },
      },
    ];
    if (activeCountry != null) {
      items.push({
        label: countryLabel(activeCountry),
        onClick: () => setSchoolId(null),
      });
    }
    if (school) {
      if (school.city) items.push({ label: school.city, onClick: () => setSchoolId(null) });
      items.push({ label: localizedName(school, lang), onClick: () => setSchoolId(null) });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCountry, school, lang, t]);

  const schoolPhotoList = allPhotos(school?.photos);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 2xl:max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight 2xl:text-3xl">{t("nav.catalog", "Catalog")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("catalog.pageDesc", "Browse schools, their courses and accommodation. Click a photo for the full gallery.")}
          </p>
        </div>
      </div>

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
          <CatalogBreadcrumb items={crumbs} />

          {/* Country strip — only meaningful with more than one country. */}
          {countries.length > 1 && !school && (
            <div className="flex flex-wrap gap-2">
              {countries.map((c) => (
                <button
                  key={c.country || "__none__"}
                  type="button"
                  onClick={() => { setCountry(c.country); setSchoolId(null); }}
                  aria-pressed={activeCountry === c.country}
                  className={
                    activeCountry === c.country
                      ? "flex items-center gap-1.5 rounded-full border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                      : "flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  }
                >
                  <Globe2 className="h-3.5 w-3.5" />
                  {countryLabel(c.country)}
                  <span className="opacity-70">({c.schools.length.toLocaleString("en-US")})</span>
                </button>
              ))}
            </div>
          )}

          {!school ? (
            /* ── Schools grid ── */
            <>
              <CatalogFilters
                schools={countrySchools}
                roomTypes={roomTypes}
                values={filters}
                onChange={setFilters}
              />

              {visibleSchools.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title={t("catalog.noMatches", "No schools match your filters")}
                  description={t("catalog.noMatchesDesc", "Try clearing some filters to see more options.")}
                  action={
                    <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                      <RefreshCw className="me-1.5 h-3.5 w-3.5" />
                      {t("catalog.clearFilters", "Clear filters")}
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 2xl:gap-6">
                  {visibleSchools.map((s) => {
                    const stats = schoolStats(s.id, data.programs, data.accommodations);
                    return (
                      <SchoolCard
                        key={s.id}
                        school={s}
                        programCount={stats.programs}
                        accommodationCount={stats.accommodations}
                        onSelect={(picked) => { setSchoolId(picked.id); setTab("accommodations"); }}
                      />
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* ── School detail ── */
            <div className="space-y-5">
              <Button variant="ghost" size="sm" onClick={() => setSchoolId(null)} className="-ms-2">
                <ArrowLeft className="me-1.5 h-4 w-4 rtl:rotate-180" />
                {t("catalog.backToSchools", "All schools")}
              </Button>

              {/* School hero */}
              <Card className="overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,320px)_1fr] 2xl:grid-cols-[minmax(0,420px)_1fr]">
                  <button
                    type="button"
                    onClick={() => schoolPhotoList.length > 0 && setSchoolPhotosOpen(true)}
                    disabled={schoolPhotoList.length === 0}
                    aria-label={t("catalog.viewPhotos", "View photos")}
                    className="relative text-start disabled:cursor-default"
                  >
                    <CatalogImage
                      src={primaryPhoto(school.photos)}
                      alt={localizedName(school, lang)}
                      aspect="aspect-[16/10] h-full"
                      icon={Building2}
                    />
                    {schoolPhotoList.length > 1 && (
                      <span className="absolute bottom-3 end-3 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                        <Images className="h-3.5 w-3.5" />
                        {schoolPhotoList.length.toLocaleString("en-US")}
                      </span>
                    )}
                  </button>

                  <div className="space-y-3 p-5 2xl:p-7">
                    <div>
                      <h2 className="text-2xl font-bold leading-tight 2xl:text-3xl">{localizedName(school, lang)}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {school.city}
                        {school.city && school.country ? ", " : ""}
                        {school.country}
                      </p>
                    </div>
                    {localizedDescription(school, lang) && (
                      <p className="text-sm leading-relaxed text-muted-foreground 2xl:text-base">
                        {localizedDescription(school, lang)}
                      </p>
                    )}
                    {school.website && (
                      <a
                        href={school.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-sm font-medium text-primary hover:underline"
                      >
                        {t("catalog.schoolWebsite", "School website")}
                      </a>
                    )}
                  </div>
                </div>
              </Card>

              {/* Tabs */}
              <div className="flex gap-2 border-b border-border">
                {([
                  { key: "programs" as const, icon: GraduationCap, label: t("catalog.programs", "programs"), count: schoolPrograms.length },
                  { key: "accommodations" as const, icon: BedDouble, label: t("catalog.accommodations", "accommodations"), count: schoolAccommodations.length },
                ]).map(({ key, icon: Icon, label, count }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    aria-pressed={tab === key}
                    className={
                      tab === key
                        ? "-mb-px flex items-center gap-2 border-b-2 border-primary px-3 py-2 text-sm font-medium capitalize text-foreground"
                        : "-mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm capitalize text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    <span className="text-xs opacity-70">({count.toLocaleString("en-US")})</span>
                  </button>
                ))}
              </div>

              {tab === "programs" ? (
                schoolPrograms.length === 0 ? (
                  <EmptyState
                    icon={GraduationCap}
                    title={t("catalog.noPrograms", "No courses listed for this school")}
                    description={t("catalog.noProgramsDesc", "Courses are managed by administrators.")}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2 2xl:gap-6">
                    {schoolPrograms.map((p) => (
                      <ProgramCard key={p.id} program={p} onOpenPhotos={setProgramPhotos} />
                    ))}
                  </div>
                )
              ) : schoolAccommodations.length === 0 ? (
                <EmptyState
                  icon={BedDouble}
                  title={t("catalog.noAccommodations", "No accommodation listed for this school")}
                  description={t("catalog.noAccommodationsDesc", "Accommodation entries are managed by administrators.")}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:gap-6">
                  {schoolAccommodations.map((a) => (
                    <AccommodationCard
                      key={a.id}
                      accommodation={a}
                      school={school}
                      size="large"
                      showSchool={false}
                      onSelect={setSelected}
                    />
                  ))}
                </div>
              )}
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

      <PhotoLightbox
        photos={schoolPhotoList}
        open={schoolPhotosOpen}
        title={school ? localizedName(school, lang) : undefined}
        subtitle={school?.city ?? undefined}
        onClose={() => setSchoolPhotosOpen(false)}
      />

      <PhotoLightbox
        photos={allPhotos(programPhotos?.photos)}
        open={!!programPhotos}
        title={programPhotos ? localizedName(programPhotos, lang) : undefined}
        subtitle={school ? localizedName(school, lang) : undefined}
        onClose={() => setProgramPhotos(null)}
      />
    </div>
  );
}
