import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "@/lib/router-compat";
import { RefreshCw, Building2, ChevronRight, Globe2, GraduationCap, BedDouble, ArrowLeft, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, EmptyState, LoadingState, ErrorState } from "@/components/shell";
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<CatalogFilterValues>(EMPTY_FILTERS);
  const [country, setCountry] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [tab, setTab] = useState<SchoolTab>("accommodations");
  const [selected, setSelected] = useState<CatalogAccommodation | null>(null);
  const [schoolPhotosOpen, setSchoolPhotosOpen] = useState(false);
  const [programPhotos, setProgramPhotos] = useState<CatalogProgram | null>(null);

  // Seed the filters from deep-link params only once; later URL changes
  // (navigation/back-forward) must never clobber the user's own filters.
  const filtersSeeded = useRef(false);

  useEffect(() => {
    const requestedCountry = searchParams.get("country");
    const requestedSchool = searchParams.get("school");
    const requestedTab = searchParams.get("tab");
    const requestedRoomType = searchParams.get("roomType") ?? "";

    setCountry(requestedCountry);

    if (requestedSchool) {
      setSchoolId(requestedSchool);
      setTab(requestedTab === "programs" ? "programs" : "accommodations");
      if (!filtersSeeded.current) {
        filtersSeeded.current = true;
        setFilters((current) => ({
          ...current,
          schoolId: requestedSchool,
          roomType: requestedRoomType,
          search: "",
        }));
      }
    } else {
      setSchoolId(null);
    }
  }, [searchParams]);

  const countries = useMemo(() => (data ? groupByCountry(data.schools) : []), [data]);

  // Country selection is always the first step of normal catalog navigation.
  // Do not auto-select the only country (currently Germany).
  const activeCountry = country;

  const countryLabel = (value: string) => value || t("catalog.otherCountry", "Other");

  const roomTypes = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const a of data.accommodations) if (a.room_type) set.add(a.room_type);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const countrySchools = useMemo(() => {
    if (!data || activeCountry == null) return [];
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

  const requestedIds = useMemo(() => {
    const raw = searchParams.get("ids");
    return raw ? raw.split(",").map((v) => v.trim()).filter(Boolean) : [];
  }, [searchParams]);

  const schoolAccommodations = useMemo(() => {
    if (!data || !school) return [];
    if (requestedIds.length) {
      return data.accommodations.filter((a) => requestedIds.includes(a.id));
    }
    return data.accommodations.filter(
      (a) => a.school_id === school.id && (!filters.roomType || a.room_type === filters.roomType),
    );
  }, [data, school, filters.roomType, requestedIds]);

  // A link that points at exactly one room opens that room straight away.
  useEffect(() => {
    if (requestedIds.length === 1 && schoolAccommodations.length === 1) {
      setSelected(schoolAccommodations[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedIds, schoolAccommodations.length]);


  const selectedSchool = useMemo(() => {
    if (!data || !selected) return null;
    return data.schools.find((s) => s.id === selected.school_id) ?? null;
  }, [data, selected]);

  // Drill-down navigation keeps the URL in sync so browser back/forward
  // return to the country selection / schools grid instead of leaving the page.
  const openCountry = (value: string) => {
    setFilters(EMPTY_FILTERS);
    setCountry(value);
    setSchoolId(null);
    const next = new URLSearchParams(searchParams);
    next.set("country", value);
    next.delete("school");
    next.delete("ids");
    next.delete("tab");
    next.delete("roomType");
    setSearchParams(next);
  };

  const backToSchools = () => {
    setSchoolId(null);
    setTab("accommodations");
    const next = new URLSearchParams(searchParams);
    next.delete("school");
    next.delete("ids");
    next.delete("tab");
    next.delete("roomType");
    setSearchParams(next);
  };

  const backToCountries = () => {
    setFilters(EMPTY_FILTERS);
    setCountry(null);
    setSchoolId(null);
    const next = new URLSearchParams(searchParams);
    next.delete("country");
    next.delete("school");
    next.delete("ids");
    next.delete("tab");
    next.delete("roomType");
    setSearchParams(next);
  };

  const openSchool = (picked: CatalogSchool) => {
    setSchoolId(picked.id);
    setTab("accommodations");
    const pickedCountry = picked.country?.trim() || "";
    const next = new URLSearchParams(searchParams);
    if (pickedCountry) next.set("country", pickedCountry);
    else next.delete("country");
    next.set("school", picked.id);
    next.set("tab", "accommodations");
    next.delete("ids");
    next.delete("roomType");
    setSearchParams(next);
  };

  const crumbs = useMemo(() => {
    const items = [
      {
        label: t("catalog.allCountries", "Catalog"),
        onClick: backToCountries,
      },
    ];
    if (activeCountry != null) {
      items.push({
        label: countryLabel(activeCountry),
        onClick: backToSchools,
      });
    }
    if (school) {
      if (school.city) items.push({ label: school.city, onClick: backToSchools });
      items.push({ label: localizedName(school, lang), onClick: backToSchools });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCountry, school, lang, t]);

  const schoolPhotoList = allPhotos(school?.photos);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 px-4 pb-8 sm:px-6 lg:px-8" dir={lang === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t("nav.catalog", "Catalog")}
        subtitle={t(
          "catalog.pageDesc",
          "Browse schools, their courses and accommodation.",
        )}
      />

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
          {school && <CatalogBreadcrumb items={crumbs} />}

          {/* Country selection is the first step, even when only one country exists. */}
          {!school && activeCountry == null && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {countries.map((c) => (
                <button
                  key={c.country || "__none__"}
                  type="button"
                  onClick={() => openCountry(c.country)}
                  className="w-full text-start"
                >
                  <Card className="flex h-full items-center justify-between gap-4 border-border px-5 py-4 transition-colors hover:border-brand/50 hover:bg-muted/40 sm:px-6">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{countryLabel(c.country)}</span>
                      </div>
                      <p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">
                        {t(
                          "catalog.countryCardDesc",
                          "Schools, courses and accommodation available in this country.",
                        )}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        {c.schools.length} {t("partnerSchools.schools", "schools")}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
                  </Card>
                </button>
              ))}
            </div>
          )}

          {!school && activeCountry != null ? (
            /* ── Schools grid ── */
            <>
              <PageHeader
                title={countryLabel(activeCountry)}
                subtitle={t(
                  "catalog.countrySubtitle",
                  "Schools, courses and accommodation in this country.",
                )}
                actions={
                  <Button variant="ghost" size="sm" onClick={backToCountries}>
                    <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                    {t("catalog.backToCountries", "Back")}
                  </Button>
                }
              />

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
                        onSelect={openSchool}
                      />
                    );
                  })}
                </div>
              )}
            </>
          ) : school ? (
            /* ── School detail ── */
            <div className="space-y-5">
              <PageHeader
                title={localizedName(school, lang)}
                subtitle={[
                  school.city,
                  school.country,
                ].filter(Boolean).join(", ")}
                actions={
                  <Button variant="ghost" size="sm" onClick={backToSchools}>
                    <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                    {t("catalog.backToSchools", "Back")}
                  </Button>
                }
              />

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
                <div className="space-y-3">
                  {requestedIds.length > 1 && (
                    <p className="text-sm text-muted-foreground">
                      {t("catalog.filteredFromSchool", "Showing only the rooms linked to the option you opened.")}
                    </p>
                  )}
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
                </div>
              )}

            </div>
          ) : null}
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
