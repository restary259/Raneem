import { useState, type ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  FileCheck2,
  GraduationCap,
  Home,
  MapPin,
  MessageCircle,
  SearchCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { whatsappBusinessUrl } from "@/lib/contactConfig";
import { useDirection } from "@/hooks/useDirection";
import { activeLanguageYearCities } from "@/data/educationalDestinations";

type TextItem = { title: string; description: string };
type GalleryStudent = { name: string; destination: string; image: string; focus?: string };
type LanguageLevel = { label: string; group: string; canDo: string };

const RoadmapStation = ({ number, title, description, children }: {
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <article className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 border-t border-border/80 py-8 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-x-6 sm:py-10">
    <div className="flex justify-center">
      <span className={"relative z-10 grid size-11 shrink-0 place-items-center rounded-full border-2 text-sm font-bold tabular-nums sm:size-12 " + (number === "01" ? "border-highlight bg-highlight text-highlight-foreground" : "border-border bg-background text-muted-foreground")}>
        {number}
      </span>
    </div>
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-10">
      <div className="min-w-0 py-1">
        <h3 className="text-balance text-2xl font-semibold leading-tight text-primary sm:text-3xl">{title}</h3>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  </article>
);

const StudentStory = ({ student, t }: {
  student: GalleryStudent;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => (
  <figure className="group relative min-w-0 overflow-hidden rounded-2xl bg-muted">
    <div className="aspect-[4/5] overflow-hidden sm:aspect-[3/4]">
      <img
        src={student.image}
        alt={student.name
          ? t("homepage.students.namedAlt", { name: student.name, destination: student.destination })
          : t("homepage.students.alt", { destination: student.destination })}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-300 ease-[var(--ease-out)] group-hover:scale-[1.03] motion-reduce:transition-none"
        style={{ objectPosition: student.focus || "50% 40%" }}
        onError={(event) => { event.currentTarget.hidden = true; }}
      />
    </div>
    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary via-primary/80 to-transparent p-3 pt-12 text-primary-foreground sm:p-4 sm:pt-14">
      {student.name ? <p className="text-sm font-bold">{student.name}</p> : null}
      <p className="mt-1 flex items-center gap-1.5 text-xs text-primary-foreground/75">
        <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
        {student.destination}
      </p>
    </figcaption>
  </figure>
);

const HomepageExperience = () => {
  const { t } = useTranslation("landing");
  const { isRtl } = useDirection();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const services = t("homepage.services.items", { returnObjects: true }) as TextItem[];
  const students = t("studentGallery.students", { returnObjects: true }) as GalleryStudent[];
  const included = t("homepage.scope.included", { returnObjects: true }) as string[];
  const decisions = t("homepage.scope.decisions", { returnObjects: true }) as string[];
  const faqs = t("homepage.faq.items", { returnObjects: true }) as TextItem[];
  const levels = t("homepage.languagePrep.levels", { returnObjects: true }) as Record<string, LanguageLevel>;
  const [selectedLevel, setSelectedLevel] = useState("A1");
  const [openFaq, setOpenFaq] = useState<string | undefined>();
  const activeLevel = levels[selectedLevel];
  const featuredCity = activeLanguageYearCities[0];

  return (
    <div className="homepage-experience bg-background">
      <section aria-labelledby="homepage-hero-title" className="relative isolate min-h-[560px] overflow-hidden bg-[#071324] text-white sm:min-h-[620px] lg:min-h-[660px]">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(12,73,112,0.8),transparent_58%),linear-gradient(180deg,#071324_0%,#0a1c33_55%,#102945_100%)]" />
        <svg viewBox="0 0 1200 420" preserveAspectRatio="xMidYMax slice" role="img" aria-label={t("homepage.hero.imageAlt")} className="absolute inset-x-0 bottom-0 h-[265px] w-full sm:h-[340px] lg:h-[400px]">
          <defs>
            <linearGradient id="darb-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#102b48" />
              <stop offset="1" stopColor="#2c526f" />
            </linearGradient>
            <linearGradient id="darb-river" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#24465f" />
              <stop offset="1" stopColor="#071324" />
            </linearGradient>
          </defs>
          <rect width="1200" height="420" fill="url(#darb-sky)" opacity="0.42" />
          <g fill="#f2c85b" opacity="0.65">
            <circle cx="122" cy="75" r="1.6" /><circle cx="264" cy="113" r="1.2" /><circle cx="425" cy="52" r="1.4" />
            <circle cx="808" cy="83" r="1.4" /><circle cx="1012" cy="42" r="1.5" /><circle cx="1110" cy="125" r="1.2" />
          </g>
          <path d="M0 277 C130 258 211 222 302 236 C416 254 485 180 590 192 C735 210 780 253 887 236 C1006 218 1097 264 1200 244 L1200 420 L0 420Z" fill="#0a1c2d" />
          <path d="M0 306 C190 280 276 288 408 270 C543 252 640 279 760 291 C914 309 1043 282 1200 301 L1200 420 L0 420Z" fill="#102a42" />
          <g fill="#0b1726" stroke="#0b1726" strokeLinejoin="round">
            <rect x="307" y="166" width="225" height="84" />
            <rect x="330" y="126" width="42" height="124" /><path d="M324 126 L351 80 L378 126Z" />
            <rect x="398" y="145" width="34" height="105" /><path d="M393 145 L415 109 L437 145Z" />
            <rect x="470" y="119" width="42" height="131" /><path d="M463 119 L491 69 L519 119Z" />
            <rect x="278" y="203" width="28" height="47" /><rect x="532" y="196" width="48" height="54" />
            <rect x="595" y="253" width="42" height="78" /><path d="M589 253 L616 216 L643 253Z" />
            <rect x="656" y="267" width="49" height="64" /><path d="M650 267 L680 228 L711 267Z" />
            <rect x="723" y="253" width="42" height="78" /><path d="M717 253 L744 214 L771 253Z" />
            <rect x="782" y="273" width="45" height="58" /><path d="M776 273 L804 238 L833 273Z" />
            <rect x="862" y="238" width="37" height="93" /><path d="M856 238 L880 200 L905 238Z" />
          </g>
          <g fill="#e6bd58" opacity="0.88">
            <rect x="339" y="151" width="7" height="12" rx="2" /><rect x="354" y="184" width="7" height="12" rx="2" />
            <rect x="406" y="165" width="7" height="12" rx="2" /><rect x="483" y="146" width="7" height="12" rx="2" />
            <rect x="502" y="184" width="7" height="12" rx="2" /><rect x="609" y="274" width="6" height="9" rx="2" />
            <rect x="670" y="288" width="6" height="9" rx="2" /><rect x="737" y="273" width="6" height="9" rx="2" />
            <rect x="874" y="256" width="6" height="9" rx="2" />
          </g>
          <path d="M0 344 C190 318 330 350 475 337 C650 321 770 341 906 330 C1020 321 1103 326 1200 337 L1200 420 L0 420Z" fill="url(#darb-river)" />
          <g fill="none" stroke="#e1ba66" strokeLinecap="round" strokeOpacity="0.38" strokeWidth="2">
            <path d="M35 365 H262" /><path d="M89 384 H309" /><path d="M380 357 H505" />
            <path d="M690 373 H852" /><path d="M922 360 H1168" /><path d="M814 393 H1071" />
          </g>
          <g fill="#081525">
            <rect x="148" y="303" width="510" height="12" rx="2" />
            <path d="M171 315 A48 48 0 0 1 267 315Z" /><path d="M280 315 A48 48 0 0 1 376 315Z" />
            <path d="M389 315 A48 48 0 0 1 485 315Z" /><path d="M498 315 A48 48 0 0 1 594 315Z" />
            <rect x="161" y="314" width="10" height="38" /><rect x="635" y="314" width="10" height="38" />
          </g>
        </svg>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#071324]/55 via-[#071324]/15 to-transparent" />
        <div className="relative z-10 mx-auto flex min-h-[560px] max-w-6xl items-start px-4 pb-[245px] pt-14 sm:min-h-[620px] sm:px-6 sm:pb-[315px] sm:pt-20 lg:min-h-[660px] lg:pb-[355px] lg:pt-24">
          <div className="max-w-4xl text-start">
            <span className="mb-5 inline-flex items-center rounded-full border border-[#f2c85b]/40 bg-white/[0.04] px-4 py-1.5 text-sm font-semibold text-[#f2c85b]">
              {t("homepage.hero.eyebrow")}
            </span>
            <h1 id="homepage-hero-title" className="text-balance text-4xl font-semibold leading-[1.12] tracking-tight sm:text-6xl lg:text-7xl">
              {t("homepage.journey.title")}
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
              {t("homepage.services.body")}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="cta" className="rounded-full bg-highlight px-7 text-highlight-foreground hover:bg-highlight/90">
                <Link to="/apply">{t("homepage.actions.startAssessment")}<Arrow /></Link>
              </Button>
              <a href={whatsappBusinessUrl("مرحبا، بدي أعرف شو خطوتي الجاية للدراسة بألمانيا.")} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight">
                <MessageCircle aria-hidden="true" className="size-4" />
                {t("homepage.actions.whatsapp")}
              </a>
            </div>
          </div>
        </div>
        <a href="#roadmap" className="absolute inset-x-0 bottom-5 z-10 mx-auto flex w-fit items-center gap-3 text-sm text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight sm:bottom-7">
          <span aria-hidden="true" className="h-8 w-px bg-highlight/80" />
          {t("homepage.journey.eyebrow")}
        </a>
      </section>

      <section id="roadmap" aria-labelledby="homepage-roadmap-title" className="bg-background py-14 sm:py-20">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 ps-[3.75rem] sm:mb-10 sm:ps-[4.5rem]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{t("homepage.services.eyebrow")}</p>
            <h2 id="homepage-roadmap-title" className="mt-3 max-w-4xl text-balance text-3xl font-semibold leading-tight text-primary sm:text-5xl">{t("homepage.services.title")}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{t("homepage.journey.body")}</p>
          </div>

          <div className="relative">
            <div aria-hidden="true" className="pointer-events-none absolute bottom-[3.5rem] start-[21px] top-[54px] w-px bg-border sm:bottom-16 sm:start-6 sm:top-16" />

            <RoadmapStation number="01" title={t("apply.heroTitle")} description={t("apply.applicationIntro")}>
              <div className="rounded-[1.75rem] border border-border/80 bg-muted/55 p-4 sm:p-6">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { label: t("apply.personalStep"), Icon: UserRound },
                    { label: t("apply.educationStep"), Icon: GraduationCap },
                    { label: t("apply.reviewStep"), Icon: FileCheck2 },
                  ].map(({ label, Icon }, index) => (
                    <div key={label} className="min-w-0 rounded-2xl border border-border/80 bg-background p-3 sm:p-4">
                      <span className="grid size-8 place-items-center rounded-full bg-highlight/30 text-brand-strong sm:size-9"><Icon aria-hidden="true" className="size-4" /></span>
                      <p className="mt-3 text-xs font-semibold leading-5 text-primary sm:text-sm">{label}</p>
                      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">0{index + 1}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/80 pt-4">
                  <span className="text-xs leading-5 text-muted-foreground">{t("apply.progressLabel")}</span>
                  <Link to="/apply" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-brand-strong hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {t("homepage.actions.startAssessment")}<Arrow className="size-4" />
                  </Link>
                </div>
              </div>
            </RoadmapStation>

            <RoadmapStation number="02" title={services[0]?.title ?? t("homepage.services.title")} description={services[0]?.description ?? t("homepage.services.body")}>
              <div className="rounded-[1.75rem] border border-border/80 bg-muted/55 p-4 sm:p-6">
                <p className="text-xs font-semibold text-muted-foreground">{t("apply.reviewTitle")}</p>
                <div className="mt-3 divide-y divide-border/80">
                  {[
                    { label: t("apply.reviewEducation"), Icon: GraduationCap },
                    { label: t("apply.reviewMajor"), Icon: BookOpenCheck },
                    { label: t("apply.reviewCity"), Icon: MapPin },
                  ].map(({ label, Icon }) => (
                    <div key={label} className="flex min-h-14 items-center gap-3 py-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background text-brand-strong"><Icon aria-hidden="true" className="size-4.5" /></span>
                      <span className="text-sm font-semibold text-primary">{label}</span>
                      <Check aria-hidden="true" className="ms-auto size-4 shrink-0 text-brand-strong" />
                    </div>
                  ))}
                </div>
              </div>
            </RoadmapStation>

            <RoadmapStation number="03" title={t("homepage.actions.whatsapp")} description={t("homepage.explained.body")}>
              <div className="relative overflow-hidden rounded-[1.75rem] bg-primary p-5 text-primary-foreground sm:p-7">
                <span aria-hidden="true" className="absolute -end-7 -top-8 size-36 rounded-full border border-primary-foreground/10" />
                <span aria-hidden="true" className="absolute -end-1 -top-2 size-24 rounded-full border border-primary-foreground/10" />
                <div className="relative z-10 flex items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-highlight text-highlight-foreground"><MessageCircle aria-hidden="true" className="size-6" /></span>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold">{t("homepage.final.eyebrow")}</h4>
                    <p className="mt-2 text-sm leading-6 text-primary-foreground/75">{t("homepage.final.body")}</p>
                    <a href={whatsappBusinessUrl("مرحبا، بدي أعرف شو خطوتي الجاية للدراسة بألمانيا.")} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-highlight px-4 text-sm font-bold text-highlight-foreground transition-colors hover:bg-highlight/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground">
                      {t("homepage.actions.whatsapp")}<Arrow className="size-4" />
                    </a>
                  </div>
                </div>
              </div>
            </RoadmapStation>

            <RoadmapStation number="04" title={t("homepage.languagePrep.title")} description={t("homepage.languagePrep.body")}>
              <div className="rounded-[1.75rem] border border-border/80 bg-muted/55 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-strong">CEFR · A1–C1</p>
                    <h4 className="mt-2 text-lg font-semibold text-primary">{t("homepage.languagePrep.guideTitle")}</h4>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-background text-brand-strong"><SearchCheck aria-hidden="true" className="size-5" /></span>
                </div>
                <div role="tablist" aria-label={t("homepage.languagePrep.levelSelector")} dir="ltr" className="mt-5 grid grid-cols-5 gap-2">
                  {["A1", "A2", "B1", "B2", "C1"].map((level) => (
                    <button
                      key={level}
                      type="button"
                      role="tab"
                      aria-selected={selectedLevel === level}
                      aria-controls="homepage-cefr-detail"
                      onClick={() => setSelectedLevel(level)}
                      className={"min-h-11 rounded-xl border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + (selectedLevel === level ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-brand/50 hover:text-primary")}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                {activeLevel ? (
                  <div id="homepage-cefr-detail" role="tabpanel" className="mt-4 min-h-32 border-t border-border/80 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h5 className="font-semibold text-primary">{activeLevel.label}</h5>
                      <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">{activeLevel.group}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{activeLevel.canDo}</p>
                  </div>
                ) : null}
                <p className="mt-4 border-s-2 border-brand ps-3 text-xs leading-6 text-muted-foreground">{t("homepage.languagePrep.cefrNote")}</p>
                <a href="https://www.coe.int/en/web/common-european-framework-reference-languages/table-1-cefr-3.3-common-reference-levels-global-scale" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center text-xs font-semibold text-brand-strong underline decoration-brand/40 underline-offset-4 hover:decoration-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {t("homepage.languagePrep.sourceLabel")}
                </a>
              </div>
            </RoadmapStation>

            <RoadmapStation number="05" title={services[1]?.title ?? t("homepage.services.title")} description={services[1]?.description ?? t("homepage.services.body")}>
              <div className="rounded-[1.75rem] border border-border/80 bg-muted/55 p-4 sm:p-6">
                <div className="space-y-3">
                  {services.slice(2, 4).map((service, index) => {
                    const Icon = index === 0 ? ShieldCheck : Home;
                    return (
                      <div key={service.title} className="flex items-start gap-3 rounded-2xl bg-background p-4">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-highlight/25 text-brand-strong"><Icon aria-hidden="true" className="size-5" /></span>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-primary">{service.title}</h4>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{service.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Link to="/services" className="mt-4 inline-flex min-h-11 items-center gap-2 px-1 text-sm font-bold text-brand-strong hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {t("nav.services")}<Arrow className="size-4" />
                </Link>
              </div>
            </RoadmapStation>

            <RoadmapStation number="06" title={services[4]?.title ?? t("homepage.path.arrivalTitle")} description={services[4]?.description ?? t("homepage.path.arrivalBody")}>
              {featuredCity ? (
                <Link to={featuredCity.id === "heidelberg" ? "/heidelberg" : "/educational-destinations"} className="group relative block min-h-64 overflow-hidden rounded-[1.75rem] bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <img src={featuredCity.imageUrl} alt={featuredCity.name} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-primary via-primary/35 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-primary-foreground sm:p-6">
                    <p className="text-xs font-semibold text-primary-foreground/70">{featuredCity.region}</p>
                    <h4 className="mt-1 text-2xl font-semibold sm:text-3xl">{featuredCity.name}</h4>
                    <span className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-highlight px-4 text-sm font-bold text-highlight-foreground">
                      {t("homepage.destinations.cta")}<Arrow className="size-4" />
                    </span>
                  </div>
                </Link>
              ) : (
                <Link to="/educational-destinations" className="inline-flex min-h-14 w-full items-center justify-between rounded-[1.75rem] border border-border bg-muted/55 px-5 text-sm font-bold text-brand-strong">
                  {t("homepage.destinations.cta")}<Arrow className="size-4" />
                </Link>
              )}
            </RoadmapStation>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-students-title" className="bg-primary py-14 text-primary-foreground sm:py-18">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-highlight">{t("homepage.students.eyebrow")}</p>
              <h2 id="homepage-students-title" className="mt-3 text-balance text-3xl font-semibold leading-tight sm:text-4xl">{t("homepage.students.title")}</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-primary-foreground/70 sm:text-base">{t("homepage.students.body")}</p>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {students.slice(0, 4).map((student, index) => (
              <StudentStory key={student.image + "-" + index} student={student} t={t} />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-scope-title" className="bg-editorial-paper py-14 sm:py-18">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{t("homepage.scope.eyebrow")}</p>
            <h2 id="homepage-scope-title" className="mt-3 text-balance text-3xl font-semibold leading-tight text-primary sm:text-4xl">{t("homepage.scope.title")}</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">{t("homepage.scope.body")}</p>
          </div>
          <div className="mt-7 grid gap-8 sm:grid-cols-2 sm:gap-12">
            <div>
              <h3 className="text-lg font-semibold text-primary">{t("homepage.scope.includedTitle")}</h3>
              <ul className="mt-4 space-y-3">
                {included.map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground"><Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand-strong" />{item}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-primary">{t("homepage.scope.decisionsTitle")}</h3>
              <ul className="mt-4 space-y-3">
                {decisions.map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />{item}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-faq-title" className="bg-background py-14 sm:py-18">
        <div className="container mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:gap-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{t("homepage.faq.eyebrow")}</p>
            <h2 id="homepage-faq-title" className="mt-3 text-balance text-3xl font-semibold text-primary sm:text-4xl">{t("homepage.faq.title")}</h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">{t("homepage.faq.body")}</p>
            <Button asChild variant="outline" className="mt-5 rounded-full">
              <Link to="/faq">{t("homepage.faq.all")}<Arrow /></Link>
            </Button>
          </div>
          <Accordion type="single" collapsible className="border-t border-border" value={openFaq} onValueChange={setOpenFaq}>
            {faqs.map((item, index) => (
              <AccordionItem key={item.title} value={"faq-" + index}>
                <AccordionTrigger className="text-start text-base font-semibold text-primary hover:no-underline sm:text-lg">{item.title}</AccordionTrigger>
                <AccordionContent className="pe-8 text-sm leading-7 text-muted-foreground">{item.description}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section aria-labelledby="homepage-final-title" className="bg-primary text-primary-foreground">
        <div className="container mx-auto flex max-w-6xl flex-col items-start justify-between gap-7 px-4 py-16 sm:px-6 sm:py-20 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-highlight">{t("homepage.final.eyebrow")}</p>
            <h2 id="homepage-final-title" className="mt-3 text-balance text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">{t("homepage.final.title")}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-primary-foreground/75 sm:text-base">{t("homepage.final.body")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button asChild size="lg" variant="cta" className="rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/90">
              <Link to="/apply">{t("homepage.actions.startAssessment")}<Arrow /></Link>
            </Button>
            <a href={whatsappBusinessUrl("مرحبا، بدي أعرف شو خطوتي الجاية للدراسة بألمانيا.")} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-primary-foreground/35 px-5 text-sm font-semibold transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight">
              <MessageCircle aria-hidden="true" className="size-4" />{t("homepage.actions.whatsapp")}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomepageExperience;
