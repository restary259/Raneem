import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Check,
  Clock3,
  Euro,
  ExternalLink,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PageHeader, LoadingState, ErrorState, EmptyState } from "@/components/shell";
import { usePartnerSchoolDetail } from "@/hooks/usePartnerSchools";
import { useLang } from "@/hooks/useLang";
import {
  formatBandLabel,
  formatEur,
  formatSchoolDate,
  localizeIncludedItem,
  partnerSchoolCatalogUrl,
  quoteCourse,
} from "@/lib/partnerSchools";
import { mealsLabel, roomTypeLabel } from "@/lib/catalogDisplay";
import SchoolCalculator from "@/components/team/partnerSchools/SchoolCalculator";

const TABS = [
  "overview",
  "courses",
  "calculator",
  "accommodation",
  "startDates",
  "application",
  "policies",
  "documents",
] as const;

export default function TeamPartnerSchoolPage() {
  const { t } = useTranslation("dashboard");
  const lang = useLang();
  const { country, school: slug } = useParams();
  const { data, loading, error, refetch } = usePartnerSchoolDetail(slug);
  const [query, setQuery] = useState("");

  const loc = (en: string | null | undefined, ar: string | null | undefined) =>
    (lang === "ar" ? ar || en : en) ?? "";

  const standard = useMemo(
    () => data?.courses.find((c) => c.is_darb_standard) ?? data?.courses[0] ?? null,
    [data],
  );
  const featuredQuote = useMemo(() => {
    const weeks = data?.school.featured_weeks ?? null;
    if (!standard || !weeks) return null;
    const tiers = (data?.courseTiers ?? []).filter((tier) => tier.course_id === standard.id);
    return { weeks, quote: quoteCourse(tiers, weeks) };
  }, [data, standard]);

  const notesOf = (kind: string) => (data?.notes ?? []).filter((n) => n.kind === kind);
  const accommodationNotes = notesOf("accommodation");
  const officialNotes = notesOf("registration_official");
  const darbNotes = notesOf("darb_recommendation");

  const datesByMonth = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof data>["startDates"]>();
    for (const date of data?.startDates ?? []) {
      const key = date.start_date.slice(0, 7);
      const current = groups.get(key) ?? [];
      current.push(date);
      groups.set(key, current);
    }
    return Array.from(groups.entries());
  }, [data?.startDates]);

  /** Structured lookup — answers come only from stored records. */
  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!data || q.length < 2) return [];
    const hits: { answer: string; source: string; verified: string | null }[] = [];
    const push = (answer: string, source?: string | null, verified?: string | null) =>
      hits.push({ answer, source: source ?? "—", verified: verified ?? null });
    const has = (...words: string[]) => words.some((w) => q.includes(w));

    for (const c of data.courses) {
      const tiers = data.courseTiers.filter((x) => x.course_id === c.id && x.kind === "booking");
      const name = loc(c.name_en, c.name_ar);
      if (has("course", "lesson", "price", "week", "دورة", "سعر", "حصة") || q.includes(String(c.lessons_per_week))) {
        push(
          `${name} — ${tiers.map((x) => `${formatBandLabel(x, lang)}: ${formatEur(x.price_per_week)}/${t("partnerSchools.week", "week")}`).join(" · ")}`,
          c.source_name,
          c.last_verified_at,
        );
      }
      if (has("include", "included", "يشمل")) {
        const items = (c.included_items as string[]) ?? [];
        if (items.length) {
          push(
            `${t("partnerSchools.included", "Included in the course price")}: ${items.map((item) => localizeIncludedItem(item, lang)).join("، ")}`,
            c.source_name,
            c.last_verified_at,
          );
        }
      }
      if (has("schedule", "time", "monday", "دوام", "وقت")) {
        push(
          `${name} — ${loc(c.schedule_text_en, c.schedule_text_ar)} · ${t("partnerSchools.maxStudents", "Maximum {{count}} students", { count: c.max_students })} · ${loc(c.start_rule_en, c.start_rule_ar)}`,
          c.source_name,
          c.last_verified_at,
        );
      }
      const weekMatch = q.match(/(\d+)\s*(week|weeks|أسبوع)/);
      if (weekMatch) {
        const w = Number(weekMatch[1]);
        const band = tiers.find((x) => w >= x.from_weeks && (x.to_weeks == null || w <= x.to_weeks));
        if (band) {
          push(
            t("partnerSchools.searchCourseQuote", "{{name}} — {{weeks}} weeks × {{rate}} = {{total}}", {
              name,
              weeks: w,
              rate: formatEur(band.price_per_week),
              total: formatEur(band.price_per_week * w),
            }),
            c.source_name,
            c.last_verified_at,
          );
        }
      }
    }

    for (const a of data.accommodations) {
      const name = loc(a.name_en, a.name_ar);
      if (has("room", "accommodation", "apartment", "studio", "breakfast", "board", "housing", "سكن", "غرفة", "شقة")) {
        const tiers = data.accommodationTiers.filter((x) => x.accommodation_id === a.id);
        push(
          `${name} — ${tiers
            .map((x) => `${formatBandLabel(x, lang)}: ${x.total_price != null ? formatEur(x.total_price) : `${formatEur(x.price_per_week)}/${t("partnerSchools.week", "week")}`}`)
            .join(" · ")}${a.minimum_age ? ` · ${t("partnerSchools.minAge", "Minimum age")} ${a.minimum_age}` : ""}`,
          a.source_name,
          a.last_verified_at,
        );
      }
      if (has("deposit", "تأمين")) push(`${name} — ${loc(a.deposit_note_en, a.deposit_note_ar)}`, a.source_name, a.last_verified_at);
      if (has("fee", "arrangement", "رسوم") && a.arrangement_fee) {
        push(
          t("partnerSchools.searchArrangementFee", "Accommodation arrangement: {{amount}} per person", { amount: formatEur(a.arrangement_fee) }),
          a.source_name,
          a.last_verified_at,
        );
      }
    }

    if (has("beginner", "start", "monday", "مبتدئ", "بداية")) {
      const beginner = data.startDates.filter((d) => d.audience === "beginner");
      push(
        `${t("partnerSchools.everyMondayExplained", "Students with prior German may start on any Monday after placement confirmation.")} ${t("partnerSchools.beginnerStartDates", "Beginner course start dates (A1)")}: ${beginner.map((d) => formatSchoolDate(d.start_date, lang)).join("، ") || t("partnerSchools.notRecorded", "Not recorded")}`,
        beginner[0]?.source_name,
        beginner[0]?.last_verified_at,
      );
    }

    for (const p of data.policies) {
      if (q.split(/\s+/).some((w) => w.length > 2 && (p.title_en?.toLowerCase().includes(w) || p.body_en?.toLowerCase().includes(w) || p.category.includes(w)))) {
        push(`${loc(p.title_en, p.title_ar)} — ${loc(p.body_en, p.body_ar)}`, p.source_name, p.last_verified_at);
      }
    }

    return hits.slice(0, 6);
  }, [query, data, lang]);

  if (loading) return <LoadingState rows={4} />;
  if (error) return <ErrorState title={error} onRetry={refetch} />;
  if (!data) return <EmptyState title={t("partnerSchools.notFound", "School not found")} />;

  const { school, version } = data;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-3 px-4 pb-8 sm:px-6 lg:px-8" dir={lang === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={school.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            {school.city}
            <span className="text-muted-foreground">·</span>
            {t("partnerSchools.pricesShown", "Prices shown")}: {version?.year ?? "—"}
            {school.last_verified_at && (
              <>
                <span className="text-muted-foreground">·</span>
                {t("partnerSchools.lastVerified", "Last verified")}: {school.last_verified_at}
              </>
            )}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to={`/team/partner-schools/${country}`}>
                <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                {t("partnerSchools.back", "Back")}
              </Link>
            </Button>
            {school.website_url && (
              <Button asChild variant="outline" size="sm">
                <a href={school.website_url} target="_blank" rel="noreferrer">
                  {t("partnerSchools.website", "School website")}
                  <ExternalLink className="ms-2 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        }
      />

      {/* Search */}
      <Card className="border-border/70 p-3 shadow-none">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("partnerSchools.searchPlaceholder", "Search {{name}} information…", { name: school.name })}
            className="ps-9"
          />
        </div>
        {query.trim().length >= 2 && (
          <div className="mt-3 space-y-2">
            {searchHits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("partnerSchools.notRecorded", "Not recorded — verify with the school")}
              </p>
            ) : (
              searchHits.map((h, i) => (
                <div key={i} className="rounded-md border border-border p-2.5 text-sm">
                  <p className="text-foreground">{h.answer}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("partnerSchools.source", "Source")}: {h.source}
                    {h.verified ? ` · ${t("partnerSchools.lastVerified", "Last verified")}: ${h.verified}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* Quick answers */}
      {standard && (
        <Card className="overflow-hidden border-brand/40 shadow-none">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="bg-brand text-brand-foreground hover:bg-brand">
                  {t("partnerSchools.darbStandard", "DARB Standard")}
                </Badge>
                <h2 className="text-base font-semibold text-foreground">{loc(standard.name_en, standard.name_ar)}</h2>
              </div>
              <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <Fact label={t("partnerSchools.lessons", "Lessons")} value={`${standard.lessons_per_week} / ${t("partnerSchools.week", "week")}`} />
                <Fact label={t("partnerSchools.schedule", "Schedule")} value={loc(standard.schedule_text_en, standard.schedule_text_ar)} />
                <Fact
                  label={t("partnerSchools.classSize", "Class size")}
                  value={
                    standard.max_students
                      ? `${t("partnerSchools.max", "Max")} ${standard.max_students}`
                      : t("partnerSchools.notRecorded", "Not recorded — verify with the school")
                  }
                />
                <Fact label={t("partnerSchools.courseStartRule", "Course start rule")} value={loc(standard.start_rule_en, standard.start_rule_ar)} />
              </div>
            </div>
            {featuredQuote && (
              <div className="border-t border-brand/20 bg-brand/5 p-4 lg:border-s lg:border-t-0">
                <p className="text-xs font-medium text-muted-foreground">{t("partnerSchools.quickAnswer", "Quick answer")}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {t("partnerSchools.featured42Title", "42-week Intensive Course")}
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold text-brand">{formatEur(featuredQuote.quote.total)}</p>
                    <p className="text-xs text-muted-foreground">
                      {featuredQuote.weeks} {t("partnerSchools.weeks", "weeks")} × {formatEur(featuredQuote.quote.pricePerWeek)}
                    </p>
                  </div>
                  <Euro className="h-5 w-5 text-brand" />
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {t("partnerSchools.featured42Note", "A 42-week tuition quote. The official A1→C1 pathway is listed separately as 44 weeks in the level calculator.")}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("partnerSchools.a1C1Exclusions", "School tuition only. Accommodation, supplements, deposits and DARB office fees are separate.")}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Tabs defaultValue="overview" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="sticky top-0 z-20 -mx-1 overflow-x-auto bg-background/95 px-1 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <TabsList className="flex h-auto w-full justify-between gap-1 p-1 rtl:flex-row">
          {TABS.map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              className="flex-1 whitespace-nowrap px-2 py-2 text-center"
            >
              {t(`partnerSchools.tab.${key}`, key)}
            </TabsTrigger>
          ))}
        </TabsList>
        </div>

        {/* Overview */}
        <TabsContent value="overview" className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card className="space-y-2 p-4">
            <h3 className="text-sm font-semibold text-foreground">{t("partnerSchools.levels", "Levels")}</h3>
            {data.levels.length === 0 ? (
              <NotRecorded />
            ) : (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {data.levels.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3">
                    <span>{l.level}</span>
                    <span className="text-end">
                      {l.weeks_max && l.weeks_max > l.weeks ? `${l.weeks}–${l.weeks_max}` : l.weeks}{" "}
                      {t("partnerSchools.weeks", "weeks")}
                      {l.hours_min && l.hours_max ? (
                        <span className="block text-xs">
                          {l.hours_min}–{l.hours_max} {t("partnerSchools.teachingHours", "teaching hours")}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="space-y-2 p-4">
            <h3 className="text-sm font-semibold text-foreground">
              {t("partnerSchools.included", "Included in the course price")}
            </h3>
            {((standard?.included_items as string[]) ?? []).length === 0 ? (
              <NotRecorded />
            ) : (
              <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                {((standard?.included_items as string[]) ?? []).map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  {localizeIncludedItem(item, lang)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        {/* Courses */}
        <TabsContent value="courses" className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            {t("partnerSchools.schoolPricesNote", "These are school prices. DARB service fees are not included.")}
          </p>
          {data.courses.map((c) => {
            const booking = data.courseTiers.filter((x) => x.course_id === c.id && x.kind === "booking");
            const extension = data.courseTiers.filter((x) => x.course_id === c.id && x.kind === "extension");
            return (
              <Card key={c.id} className={`p-4 ${c.is_darb_standard ? "border-brand/40" : ""}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{loc(c.name_en, c.name_ar)}</h3>
                  {c.is_darb_standard && (
                    <Badge className="bg-brand text-brand-foreground hover:bg-brand">
                      {t("partnerSchools.darbStandard", "DARB Standard")}
                    </Badge>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                <PriceTable title={t("partnerSchools.bookingPrice", "Booking price")} rows={booking} lang={lang} />
                  {extension.length > 0 && (
                    <PriceTable title={t("partnerSchools.extensionPrice", "Extension price")} rows={extension} lang={lang} />
                  )}
                </div>
                <SourceLine name={c.source_name} doc={c.source_document} verified={c.last_verified_at} t={(k, d) => t(k, d ?? k)} />
              </Card>
            );
          })}
          {version?.summer_supplement_per_week && (
            <p className="text-xs text-muted-foreground">
              {t("partnerSchools.summerNote", "Summer supplement")}: {formatEur(version.summer_supplement_per_week)}/
              {t("partnerSchools.week", "week")} · {version.summer_from} → {version.summer_to}
            </p>
          )}
        </TabsContent>

        {/* Calculator */}
        <TabsContent value="calculator" className="mt-3">
          <SchoolCalculator
            courses={data.courses}
            courseTiers={data.courseTiers}
            levels={data.levels}
            accommodations={data.accommodations}
            accommodationTiers={data.accommodationTiers}
            version={version}
            lang={lang}
          />
        </TabsContent>

        {/* Accommodation */}
        <TabsContent value="accommodation" className="mt-3 space-y-3">
          {accommodationNotes.length > 0 ? (
            accommodationNotes.map((n) => (
              <Card key={n.id} className="border-brand/30 bg-brand/5 p-4 shadow-none">
                <h3 className="text-sm font-semibold text-foreground">{loc(n.title_en, n.title_ar)}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{loc(n.body_en, n.body_ar)}</p>
              </Card>
            ))
          ) : (
            <Card className="border-brand/30 bg-brand/5 p-4 shadow-none">
              <h3 className="text-sm font-semibold text-foreground">
                {t("partnerSchools.singleRoomSettingTitle", "Where is the single room?")}
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("partnerSchools.singleRoomSetting", "KAPITO single rooms may be with a host family, an individual host, or in a shared flat. The exact placement is confirmed by the school and is not guaranteed in advance.")}
              </p>
            </Card>
          )}
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link to={school.catalog_school_id ? `/team/catalog?school=${school.catalog_school_id}&tab=accommodations` : "/team/catalog"}>
                {t("partnerSchools.openCatalog", "Open DARB Catalog")}
                <ExternalLink className="ms-2 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          {data.accommodations.length === 0 && <NotRecorded />}
          <Accordion type="single" collapsible className="overflow-hidden rounded-md border border-border bg-card px-4">
            {data.accommodations.map((a) => {
              const tiers = data.accommodationTiers.filter((x) => x.accommodation_id === a.id);
              const catalogUrl = partnerSchoolCatalogUrl({
                schoolId: school.catalog_school_id,
                roomType: a.room_type,
                meals: a.meals,
              });
              return (
                <AccordionItem key={a.id} value={a.id} className="last:border-b-0">
                  <AccordionTrigger className="gap-3 py-3 text-start hover:no-underline">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <BedDouble className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-foreground">{loc(a.name_en, a.name_ar)}</span>
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          {roomTypeLabel(a.room_type, lang)} · {mealsLabel(a.meals, lang)} · {t("partnerSchools.from", "from")} {formatEur(a.from_price_per_week)}/{t("partnerSchools.week", "week")}
                        </span>
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 ps-12">
                    <ul className="divide-y divide-border/60 rounded-md border border-border/70 px-3 text-sm text-muted-foreground">
                    {tiers.map((x) => (
                      <li key={x.id} className="flex items-center justify-between gap-4 py-2">
                        <span>{formatBandLabel(x, lang)}</span>
                        <span className="text-end font-medium text-foreground">
                          {x.total_price != null
                            ? formatEur(x.total_price)
                            : `${formatEur(x.price_per_week)}/${t("partnerSchools.week", "week")}`}
                          {x.extra_day_price != null && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {t("partnerSchools.extraDay", "Extra day")}: {formatEur(x.extra_day_price)}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-1.5">
                    {roomTypeLabel(a.room_type, lang) && <Badge variant="outline">{roomTypeLabel(a.room_type, lang)}</Badge>}
                    {mealsLabel(a.meals, lang) && <Badge variant="outline">{mealsLabel(a.meals, lang)}</Badge>}
                    {a.minimum_age && (
                      <Badge variant="secondary">
                        {t("partnerSchools.minAge", "Minimum age")} {a.minimum_age}
                      </Badge>
                    )}
                    {a.arrangement_fee && (
                      <Badge variant="secondary">
                        {t("partnerSchools.arrangementFee", "Accommodation arrangement")} {formatEur(a.arrangement_fee)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{loc(a.deposit_note_en, a.deposit_note_ar)}</p>
                  {!a.availability_confirmed && (
                    <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                      {loc(a.availability_note_en, a.availability_note_ar)}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
                    <SourceLine name={a.source_name} doc={a.source_document} verified={a.last_verified_at} t={(k, d) => t(k, d ?? k)} />
                    {catalogUrl ? (
                      <Button asChild variant="outline" size="sm">
                        <Link to={catalogUrl}>
                          {t("partnerSchools.viewInCatalog", "View in catalog")}
                          <ExternalLink className="ms-2 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("partnerSchools.notInCatalog", "Not in the DARB catalog — the school arranges this option directly.")}
                      </span>
                    )}
                  </div>
                </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </TabsContent>

        {/* Start dates */}
        <TabsContent value="startDates" className="mt-3 space-y-3">
          <Card className="flex items-start gap-3 border-brand/35 bg-brand/5 p-4 shadow-none">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("partnerSchools.withGermanStart", "Students with prior German")}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("partnerSchools.everyMondayExplained", "Students with prior German may start on any Monday after the school confirms their placement level.")}
              </p>
            </div>
          </Card>
          <Card className="space-y-3 p-4 shadow-none">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarDays className="h-4 w-4" />
               {t("partnerSchools.beginnerStartDates", "Beginner course start dates (A1)")}
            </h3>
            {data.startDates.length === 0 ? (
              <NotRecorded />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {datesByMonth.map(([month, dates]) => (
                  <div key={month} className="rounded-md border border-border/70 p-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      {new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dates.map((date) => (
                        <Badge key={date.id} variant="secondary" className="font-normal">{formatSchoolDate(date.start_date, lang)}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm leading-6 text-muted-foreground">
              {t("partnerSchools.beginnerDatesExplained", "Students beginning A1 with no previous German must choose one of these published start dates.")}
            </p>
            <SourceLine
              name={data.startDates[0]?.source_name}
              doc={data.startDates[0]?.source_document}
              verified={data.startDates[0]?.last_verified_at}
              t={(k, d) => t(k, d ?? k)}
            />
          </Card>
        </TabsContent>

        {/* Application guidance */}
        <TabsContent value="application" className="mt-3 space-y-3">
          {officialNotes.length > 0 ? (
            officialNotes.map((n) => (
              <Card key={n.id} className="border-brand/35 p-4 shadow-none">
                <Badge variant="outline">{t("partnerSchools.officialSchoolRuleGeneric", "Official school procedure")}</Badge>
                <h3 className="mt-3 text-sm font-semibold text-foreground">{loc(n.title_en, n.title_ar)}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{loc(n.body_en, n.body_ar)}</p>
              </Card>
            ))
          ) : (
            <Card className="border-brand/35 p-4 shadow-none">
              <Badge variant="outline">{t("partnerSchools.officialSchoolRule", "Official KAPITO procedure")}</Badge>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {t("partnerSchools.officialApplicationTitle", "Registration and payment timing")}
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("partnerSchools.officialApplicationBody", "Send the registration form, then pay the €200 deposit or the full course fee. KAPITO reserves the course place after receiving the deposit. The remaining amount is due one week before the course starts.")}
              </p>
            </Card>
          )}
          {darbNotes.length > 0 ? (
            darbNotes.map((n) => (
              <Card key={n.id} className="border-amber-500/35 bg-amber-500/10 p-4 shadow-none">
                <Badge variant="secondary">{t("partnerSchools.darbRecommendation", "DARB office recommendation")}</Badge>
                <h3 className="mt-3 text-sm font-semibold text-foreground">{loc(n.title_en, n.title_ar)}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{loc(n.body_en, n.body_ar)}</p>
              </Card>
            ))
          ) : (
            <Card className="border-amber-500/35 bg-amber-500/10 p-4 shadow-none">
              <Badge variant="secondary">{t("partnerSchools.darbRecommendation", "DARB office recommendation")}</Badge>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {t("partnerSchools.whenToApply", "When should we apply?")}
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("partnerSchools.darbApplicationTiming", "Submit 1–2 months before the preferred start date to improve the chance of securing the preferred accommodation. This is DARB office guidance, not a KAPITO minimum registration period.")}
              </p>
            </Card>
          )}
          {data.policies
            .filter((p) => p.category === "registration" || p.category === "arrival")
            .map((p) => (
              <Card key={p.id} className="space-y-1 p-4">
                <h3 className="text-sm font-semibold text-foreground">{loc(p.title_en, p.title_ar)}</h3>
                <p className="text-sm text-muted-foreground">{loc(p.body_en, p.body_ar)}</p>
                <SourceLine name={p.source_name} doc={p.source_document} verified={p.last_verified_at} t={(k, d) => t(k, d ?? k)} />
              </Card>
            ))}
        </TabsContent>

        {/* Policies */}
        <TabsContent value="policies" className="mt-3 space-y-3">
          {data.policies.length === 0 && <NotRecorded />}
          {data.policies.map((p) => (
            <Card key={p.id} className="space-y-1 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4" />
                {loc(p.title_en, p.title_ar)}
              </h3>
              <p className="text-sm text-muted-foreground">{loc(p.body_en, p.body_ar)}</p>
              <SourceLine name={p.source_name} doc={p.source_document} verified={p.last_verified_at} t={(k, d) => t(k, d ?? k)} />
            </Card>
          ))}
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="mt-3 space-y-2">
          {data.sources.length === 0 && <NotRecorded />}
          {data.sources.map((s) => (
            <Card key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-foreground">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{s.name}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.document_path ?? s.url}
                  {s.last_verified_at ? ` · ${t("partnerSchools.lastVerified", "Last verified")}: ${s.last_verified_at}` : ""}
                </p>
              </div>
              {s.url && (
                <Button asChild variant="ghost" size="sm">
                  <a href={s.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Arabic script must never be uppercased or letter-spaced — it breaks joining. */
const microLabel = "text-xs font-medium text-muted-foreground ltr:uppercase ltr:tracking-wide";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className={microLabel}>{label}</div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function PriceTable({ title, rows, lang }: { title: string; rows: any[]; lang: "en" | "ar" }) {
  return (
    <div>
      <div className={`mb-1 ${microLabel}`}>{title}</div>
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between border-b border-border/60 py-1 last:border-0">
            <span className="text-muted-foreground">{formatBandLabel(r, lang)}</span>
            <span className="font-medium text-foreground">{formatEur(r.price_per_week)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NotRecorded() {
  const { t } = useTranslation("dashboard");
  return (
    <p className="text-sm text-muted-foreground">
      {t("partnerSchools.notRecorded", "Not recorded — verify with the school")}
    </p>
  );
}

function SourceLine({
  name,
  doc,
  verified,
  t,
}: {
  name?: string | null;
  doc?: string | null;
  verified?: string | null;
  t: (k: string, d?: string) => string;
}) {
  if (!name && !doc) return null;
  return (
    <p className="pt-2 text-xs text-muted-foreground">
      {t("partnerSchools.source", "Source")}: {name ?? doc}
      {verified ? ` · ${t("partnerSchools.lastVerified", "Last verified")}: ${verified}` : ""}
    </p>
  );
}
