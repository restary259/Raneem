import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import { MapPinned, Search, SlidersHorizontal, ShoppingCart, Dumbbell, GraduationCap, Home, TrainFront, HeartPulse, Clapperboard, CircleDot, Landmark, ChevronRight, ChevronLeft, ArrowUpRight } from "lucide-react";
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

function categoryLabel(category: StudentCityGuideCategory, t: (key: string, fallback?: string) => string) {
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

function matchesSearch(location: StudentCityGuideLocation, search: string) {
  const q = search.trim().toLocaleLowerCase();
  if (!q) return true;
  return [location.nameEn, location.nameAr, location.nameHe, location.address]
    .filter(Boolean)
    .some((value) => value!.toLocaleLowerCase().includes(q));
}

export default function StudentCityGuide({ residentialCity, variant = "preview" }: StudentCityGuideProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("dashboard");
  const language = i18n.language;
  const [storedCity, setStoredCity] = useState<string | null>(residentialCity ?? null);
  const [profileLoading, setProfileLoading] = useState(!residentialCity);
  const [selectedCategory, setSelectedCategory] = useState<StudentCityGuideCategory>("all");
  const [search, setSearch] = useState("");

  const loadProfileCity = useCallback(async (uid: string) => {
    setProfileLoading(true);
    const { data } = await (supabase as any)
      .from("profiles")
      .select("residential_city")
      .eq("id", uid)
      .maybeSingle();
    setStoredCity(data?.residential_city ?? null);
    setProfileLoading(false);
  }, []);

  const userId = useAuthedUserId();

  useEffect(() => {
    if (residentialCity !== undefined) {
      setStoredCity(residentialCity ?? null);
      setProfileLoading(false);
    } else if (userId) {
      void loadProfileCity(userId);
    }
  }, [residentialCity, userId, loadProfileCity]);

  const city = getCityGuide(storedCity);

  const filteredLocations = useMemo(() => {
    if (!city) return [];
    const categoryFiltered = selectedCategory === "all"
      ? city.locations
      : city.locations.filter((location) => location.category === selectedCategory);
    const searchFiltered = categoryFiltered.filter((location) => matchesSearch(location, search));
    return variant === "preview" ? searchFiltered.slice(0, 12) : searchFiltered;
  }, [city, search, selectedCategory, variant]);

  if (!residentialCity && (!userId || profileLoading)) return <DashboardLoading />;
  if (!city) {
    return variant === "full" ? (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto" dir={language === "ar" ? "rtl" : "ltr"}>
        <Card>
          <CardContent className="py-12 text-center">
            <MapPinned className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h1 className="text-xl font-semibold">{t("student.cityGuide.unavailableTitle", "City guide")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("student.cityGuide.unavailableDescription", "Your city guide will appear once your German residential city is saved in your profile.")}
            </p>
          </CardContent>
        </Card>
      </div>
    ) : null;
  }

  const visibleCategories = variant === "preview"
    ? CATEGORY_ORDER
    : [...CATEGORY_ORDER, "pharmacy", "studentLife"];

  return (
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
                {t("student.cityGuide.heroDescription", "Discover the places you will actually use — shopping, school, transport, fitness and more.")}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button asChild size="sm" className="gap-2">
                  <a href={mapsSearchUrl(city.mapQuery)} target="_blank" rel="noopener noreferrer">
                    <MapPinned className="h-4 w-4" />
                    {t("student.cityGuide.viewMap", "View full map")}
                  </a>
                </Button>
                {variant === "preview" && (
                  <Button variant="outline" size="sm" className="bg-background/90" onClick={() => navigate("/student/city-guide")}>
                    {t("student.cityGuide.viewAll", "View all")}
                    {language === "ar" ? <ChevronLeft className="ms-1 h-4 w-4" /> : <ChevronRight className="ms-1 h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

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
          aria-label={t("student.cityGuide.filter", "Filter places")}
          title={t("student.cityGuide.filter", "Filter places")}
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
            {language === "ar" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
            const description = displayDescription(location, language);
            return (
              <a
                key={location.id}
                href={mapsSearchUrl(location.mapQuery)}
                target="_blank"
                rel="noopener noreferrer"
                className="group min-w-0 overflow-hidden rounded-lg border border-border bg-background transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${name} — ${t("student.cityGuide.openMap", "Open in Google Maps")}`}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  <img
                    src={location.imageUrl ?? FALLBACK_IMAGE}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                    onError={(event) => {
                      const image = event.currentTarget;
                      if (image.src !== FALLBACK_IMAGE) image.src = FALLBACK_IMAGE;
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
                      {location.distance ?? displayDescription(location, language) ?? categoryLabel(location.category, t)}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
              </a>
            );
          })}
        </div>
      )}

      {variant === "full" && (
        <p className="pt-1 text-xs text-muted-foreground">
          {t("student.cityGuide.mapsNote", "Place names and directions open in Google Maps. General places should be kept current through Maps search; F+U accommodation is curated from DARB's school information.")}
        </p>
      )}
    </section>
  );
}
