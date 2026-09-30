import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Lightbulb, Star, MapPinned, Search, SlidersHorizontal, ShoppingCart, Dumbbell, GraduationCap, Home, TrainFront, HeartPulse, Clapperboard, CircleDot, Landmark, ChevronRight, ChevronLeft, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import {
  HEIDELBERG_CITY_GUIDE,
  getCityGuide,
  mapsSearchUrl,
  type StudentCityGuideCategory,
  type StudentCityGuideLocation,
} from "@/data/studentCityGuides";
import { useServerFn } from "@tanstack/react-start";
import { getCityGuidePlaces, type CityGuidePlace } from "@/lib/cityGuidePlaces.functions";
import CityGuideMap, { type CityGuideMapPin } from "@/components/student/CityGuideMap";

interface StudentCityGuideProps {
  residentialCity?: string | null;
  variant?: "preview" | "full";
}

const CATEGORY_ORDER: StudentCityGuideCategory[] = [
  "all",
  "supermarkets",
  "accommodation",
  "school",
  "gyms",
  "transport",
  "healthcare",
  "football",
  "cinema",
];

const CATEGORY_ICONS: Record<StudentCityGuideCategory, ComponentType<{ className?: string }>> = {
  all: MapPinned,
  supermarkets: ShoppingCart,
  accommodation: Home,
  school: GraduationCap,
  gyms: Dumbbell,
  transport: TrainFront,
  healthcare: HeartPulse,
  football: CircleDot,
  cinema: Clapperboard,
  studentLife: Landmark,
  pharmacy: HeartPulse,
};

const FALLBACK_IMAGE = HEIDELBERG_CITY_GUIDE.heroImage;

// Mirrors the app-level direction rule in src/i18n.ts (Arabic + Hebrew are RTL).
const isRtlLanguage = (language: string) => language === "ar" || language === "he";

function displayName(location: StudentCityGuideLocation, language: string) {
  if (language === "ar") return location.nameAr;
  if (language === "he") return location.nameHe;
  return location.nameEn;
}

function displayDescription(location: StudentCityGuideLocation, language: string) {
  if (language === "ar") return location.descriptionAr;
  if (language === "he") return location.descriptionHe;
  return location.descriptionEn;
}

function displayTip(location: StudentCityGuideLocation, language: string) {
  if (language === "ar") return location.tipAr;
  if (language === "he") return location.tipHe;
  return location.tipEn;
}

function categoryLabel(category: StudentCityGuideCategory, t: TFunction<"dashboard">) {
  const fallback: Record<StudentCityGuideCategory, string> = {
    all: "All",
    supermarkets: "Supermarkets",
    accommodation: "Accommodation",
    school: "School",
    gyms: "Gyms",
    transport: "Transport",
    healthcare: "Healthcare",
    football: "Football",
    cinema: "Cinema",
    studentLife: "Student life",
    pharmacy: "Pharmacy",
  };
  return t(`student.cityGuide.categories.${category}`, fallback[category]);
}

function matchesSearch(location: StudentCityGuideLocation, search: string, t: TFunction<"dashboard">) {
  const q = search.trim().toLocaleLowerCase();
  if (!q) return true;
  // Include the localized category label so the suggested queries ("supermarket",
  // "gym") match places listed under their business names.
  return [location.nameEn, location.nameAr, location.nameHe, location.address, categoryLabel(location.category, t)]
    .filter(Boolean)
    .some((value) => value!.toLocaleLowerCase().includes(q));
}

export default function StudentCityGuide({ residentialCity, variant = "preview" }: StudentCityGuideProps) {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const [storedCity, setStoredCity] = useState<string | null>(residentialCity ?? null);
  const [profileLoading, setProfileLoading] = useState(!residentialCity);
  const [citySource, setCitySource] = useState<"residential" | "school" | null>(
    residentialCity ? "residential" : null,
  );
  const [selectedCategory, setSelectedCategory] = useState<StudentCityGuideCategory>("all");
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState(false);

  const loadProfileCity = useCallback(async (uid: string) => {
    setProfileLoading(true);
    setLoadError(false);

    const { data: profile, error: profileError } = await (supabase as any)
      .from("profiles")
      .select("residential_city, language_school_id")
      .eq("id", uid)
      .maybeSingle();

    if (profileError) {
      setLoadError(true);
      setProfileLoading(false);
      return;
    }

    const directCity =
      typeof profile?.residential_city === "string" && profile.residential_city.trim()
        ? profile.residential_city.trim()
        : null;

    if (directCity) {
      setStoredCity(directCity);
      setCitySource("residential");
      setProfileLoading(false);
      return;
    }

    // Backward compatibility for already-onboarded students whose structured
    // residential_city field is still empty: resolve the selected school city
    // from the student's own language_school_id. This is one scoped lookup, not
    // a city-wide database scan.
    if (profile?.language_school_id) {
      const { data: school, error: schoolError } = await (supabase as any)
        .from("schools")
        .select("city")
        .eq("id", profile.language_school_id)
        .maybeSingle();

      if (schoolError) {
        setLoadError(true);
        setProfileLoading(false);
        return;
      }

      const schoolCity =
        typeof school?.city === "string" && school.city.trim()
          ? school.city.trim()
          : null;

      if (schoolCity) {
        setStoredCity(schoolCity);
        setCitySource("school");
        setProfileLoading(false);
        return;
      }
    }

    setStoredCity(null);
    setCitySource(null);
    setProfileLoading(false);
  }, []);

  const userId = useAuthedUserId();

  useEffect(() => {
    if (typeof residentialCity === "string" && residentialCity.trim()) {
      setStoredCity(residentialCity.trim());
      setCitySource("residential");
      setProfileLoading(false);
    } else if (userId) {
      void loadProfileCity(userId);
    }
  }, [residentialCity, userId, loadProfileCity]);

  const city = getCityGuide(storedCity);
  const fetchPlaces = useServerFn(getCityGuidePlaces);
  const [places, setPlaces] = useState<Record<string, CityGuidePlace>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!city || !userId) return;
    let cancelled = false;
    fetchPlaces({ data: { cityId: city.id } })
      .then((rows) => {
        if (!cancelled) setPlaces(Object.fromEntries(rows.map((r) => [r.location_id, r])));
      })
      .catch((e) => console.warn("City guide places unavailable", e));
    return () => {
      cancelled = true;
    };
  }, [city, userId, fetchPlaces]);

  const handleSelectPin = useCallback((id: string) => {
    setSelectedId(id);
    document.getElementById(`city-place-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const filteredLocations = useMemo(() => {
    if (!city) return [];
    const categoryFiltered = selectedCategory === "all"
      ? city.locations
      : city.locations.filter((location) => location.category === selectedCategory);
    const searchFiltered = categoryFiltered.filter((location) => matchesSearch(location, search, t));
    return variant === "preview" ? searchFiltered.slice(0, 12) : searchFiltered;
  }, [city, search, selectedCategory, variant, t]);

  if (!residentialCity && (!userId || profileLoading)) return <DashboardLoading />;
  if (!city) {
    // A failed profile/school read is not an unsupported city: surface a retry
    // instead of the "no guide for this city" empty state.
    if (loadError && userId) {
      return variant === "full" ? (
        <div className="mx-auto max-w-5xl p-4 sm:p-6" dir={isRtlLanguage(language) ? "rtl" : "ltr"}>
          <Card>
            <CardContent className="py-12 text-center">
              <MapPinned className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <h1 className="text-xl font-semibold">{t("student.cityGuide.unavailableTitle", "City guide")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("student.cityGuide.loadFailed", "We couldn't load your city just now.")}
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadProfileCity(userId)}>
                {t("common.retry", "Retry")}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null;
    }
    return variant === "full" ? (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto" dir={isRtlLanguage(language) ? "rtl" : "ltr"}>
        <Card>
          <CardContent className="py-12 text-center">
            <MapPinned className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h1 className="text-xl font-semibold">{t("student.cityGuide.unavailableTitle", "City guide")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("student.cityGuide.unsupportedCityDescription", "A city guide for this city is not available yet.")}
            </p>
          </CardContent>
        </Card>
      </div>
    ) : null;
  }

  const visibleCategories: StudentCityGuideCategory[] = variant === "preview"
    ? CATEGORY_ORDER
    : [...CATEGORY_ORDER, "pharmacy", "studentLife"];

  const content = (
    <section id="city-guide" className="space-y-4 min-w-0">
      {variant === "full" && (
        <div>
          <div className="flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-2xl font-bold text-foreground">
              {t("student.cityGuide.title", "City Guide")}
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("student.cityGuide.subtitle", "Useful places around your study and home life in {{city}}.", { city: language === "ar" ? city.nameAr : language === "he" ? city.nameHe : city.nameEn })}
          </p>
        </div>
      )}

      <Card className="overflow-hidden border-border">
        <div className="relative min-h-[210px] overflow-hidden">
          <img
            src={city.heroImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-foreground/50" />
          <div className="relative flex min-h-[210px] items-end p-5 sm:p-7">
            <div className="min-w-0 max-w-xl rounded-lg bg-background/90 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2 text-primary">
                <MapPinned className="h-4 w-4 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {t("student.cityGuide.yourCity", "Your city")}
                </span>
              </div>
              <h2 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                {language === "ar" ? city.nameAr : language === "he" ? city.nameHe : city.nameEn}, Germany
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {citySource === "school"
                  ? t(
                      "student.cityGuide.schoolCityDescription",
                      "Showing useful places around your language school city. You can change your German residential city in your profile later.",
                    )
                  : t(
                      "student.cityGuide.heroDescription",
                      "Discover the places you will actually use — shopping, school, transport, fitness and more.",
                    )}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    if (variant !== "full") {
                      navigate("/student/city-guide");
                      return;
                    }
                    setSelectedId(null);
                    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <MapPinned className="h-4 w-4" />
                  {t("student.cityGuide.viewMap", "View full map")}
                </Button>
                {variant === "preview" && (
                  <Button variant="outline" size="sm" className="bg-background/90" onClick={() => navigate("/student/city-guide")}>
                    {t("student.cityGuide.viewAll", "View all")}
                    {isRtlLanguage(language) ? <ChevronLeft className="ms-1 h-4 w-4" /> : <ChevronRight className="ms-1 h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {variant === "full" && (
        <div ref={mapRef} className="scroll-mt-20">
        <CityGuideMap
          center={{ lat: 49.4093, lng: 8.6937 }}
          selectedId={selectedId}
          onSelect={handleSelectPin}
          pins={filteredLocations.flatMap((l): CityGuideMapPin[] => {
            const p = places[l.id];
            return p?.lat != null && p?.lng != null ? [{ id: l.id, name: displayName(l, language), lat: p.lat, lng: p.lng }] : [];
          })}
        />
        </div>
      )}

      <div className="flex min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("student.cityGuide.searchPlaceholder", "Search places (e.g. supermarket, gym, hospital…)")}
            className="h-10 ps-9 pe-3"
            aria-label={t("student.cityGuide.searchPlaceholder", "Search places")}
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={() => {
            setSearch("");
            setSelectedCategory("all");
          }}
          disabled={!search && selectedCategory === "all"}
          aria-label={t("student.cityGuide.clearFilters", "Clear filters")}
          title={t("student.cityGuide.clearFilters", "Clear filters")}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div
        className="flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={t("student.cityGuide.categoriesLabel", "Place categories")}
      >
        {visibleCategories.map((category) => {
          const Icon = CATEGORY_ICONS[category];
          const active = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedCategory(category)}
              className={[
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {categoryLabel(category, t)}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">
          {t("student.cityGuide.popular", "Popular near you")}
        </h2>
        {variant === "preview" && (
          <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={() => navigate("/student/city-guide")}>
            {t("student.cityGuide.viewAll", "View all")}
            {isRtlLanguage(language) ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {filteredLocations.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("student.cityGuide.noResults", "No matching places. Try another search or category.")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filteredLocations.map((location) => {
            const Icon = CATEGORY_ICONS[location.category];
            const name = displayName(location, language);
            const place = places[location.id];
            const tip = displayTip(location, language);
            return (
              <div
                key={location.id}
                id={`city-place-${location.id}`}
                className={[
                  "group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background transition-colors",
                  selectedId === location.id ? "border-primary ring-2 ring-primary/30" : "border-border",
                ].join(" ")}
              >
              <a
                href={mapsSearchUrl(location.mapQuery)}
                target="_blank"
                rel="noopener noreferrer"
                onFocus={() => setSelectedId(location.id)}
                onMouseEnter={() => variant === "full" && setSelectedId(location.id)}
                className="block min-w-0 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${name} — ${t("student.cityGuide.openMap", "Open in Google Maps")}`}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  <img
                    src={location.imageUrl ?? place?.photo_uri ?? FALLBACK_IMAGE}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                    onError={(event) => {
                      const image = event.currentTarget;
                      // Compare the authored attribute, not `image.src` (the browser
                      // resolves it to an absolute URL, so the guard would never match
                      // and the failed fallback would be re-assigned on every error).
                      if (image.getAttribute("src") !== FALLBACK_IMAGE) image.src = FALLBACK_IMAGE;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/65 via-transparent to-transparent" />
                  <div className="absolute bottom-2 start-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-primary shadow-sm backdrop-blur-sm">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="flex min-w-0 items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">{name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {displayDescription(location, language) ?? categoryLabel(location.category, t)}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                {(place?.rating != null || place?.open_now != null) && (
                  <div className="flex flex-wrap items-center gap-2 px-3 pb-2 text-xs">
                    {place?.rating != null && (
                      <span className="inline-flex items-center gap-1 text-foreground">
                        <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                        {place.rating.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                        {place.rating_count != null && (
                          <span className="text-muted-foreground">({place.rating_count.toLocaleString("en-US")})</span>
                        )}
                      </span>
                    )}
                    {place?.open_now != null && (
                      <span className={place.open_now ? "text-primary font-medium" : "text-muted-foreground"}>
                        {place.open_now ? t("student.cityGuide.openNow", "Open now") : t("student.cityGuide.closed", "Closed")}
                      </span>
                    )}
                  </div>
                )}
              </a>
              {tip && (
                <div className="mt-auto border-t border-border bg-muted/40 px-3 py-2">
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    <Lightbulb className="h-3 w-3 shrink-0" />
                    {t("student.cityGuide.darbTip", "DARB tip")}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-foreground/80">{tip}</p>
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}

    </section>
  );

  if (variant === "full") {
    return <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">{content}</div>;
  }

  return content;
}
