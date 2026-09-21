import { Link } from "@/lib/router-compat";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleCheck,
  Compass,
  FileCheck2,
  GraduationCap,
  HeartHandshake,
  Home,
  Languages,
  MapPin,
  MessageCircle,
  Plane,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { whatsappBusinessUrl } from "@/lib/contactConfig";
import { useDirection } from "@/hooks/useDirection";
import germanyHero from "@/assets/germany-home-hero.jpg";
import { languageYearCities, languageYearSchools, tu9Universities } from "@/data/educationalDestinations";

type TextItem = { title: string; description: string };
type GalleryStudent = { name: string; destination: string; image: string; focus?: string };

const serviceIcons = [SearchCheck, FileCheck2, ShieldCheck, Home, HeartHandshake];
const routeIcons = [GraduationCap, Languages, Compass];
const journeyIcons = [SearchCheck, FileCheck2, Plane, GraduationCap];
const examBrands = [
  { id: "telc", label: "telc", subtitle: "German language exams", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3f/Telc_GmbH_logo.svg", website: "https://www.telc.net/en/" },
  { id: "TestDaF", label: "TestDaF", subtitle: "German for university", logoUrl: "https://www.gast.de/fileadmin/gast.de/GAST/3_Logos-Icons-Grafiken/1-g.a.s.t.-Logos/Bereitgestellte_Logos/TestDaF_RGB_transparent.png", website: "https://www.testdaf.de/" },
  { id: "TestAS", label: "TestAS", subtitle: "Academic aptitude test", logoUrl: "https://www.gast.de/fileadmin/gast.de/GAST/3_Logos-Icons-Grafiken/1-g.a.s.t.-Logos/Bereitgestellte_Logos/TestAS_RGB_transparent.png", website: "https://www.testas.de/en/" },
  { id: "onSET", label: "onSET", subtitle: "Online language placement", logoUrl: "https://www.gast.de/fileadmin/gast.de/GAST/3_Logos-Icons-Grafiken/1-g.a.s.t.-Logos/Bereitgestellte_Logos/onSET_RGB_transparent.png", website: "https://www.onset.de/" },
  { id: "DSH", label: "DSH", subtitle: "University entrance language exam", website: "https://www.fadaf.de/dsh/" },
  { id: "Goethe", label: "Goethe-Zertifikat", subtitle: "German language certificate", website: "https://www.goethe.de/en/spr/kup/prf.html" },
  { id: "IELTS", label: "IELTS", subtitle: "English language test", website: "https://ielts.org/" },
  { id: "TOEFL", label: "TOEFL", subtitle: "English language test", website: "https://www.ets.org/toefl.html" },
];

const ecosystemExams = examBrands.map((exam) => exam.id);

const StudentFigure = ({
  student,
  index,
  t,
  className,
}: {
  student: GalleryStudent;
  index: number;
  t: (key: string, options?: Record<string, unknown>) => string;
  className?: string;
}) => (
  <figure
    className={`relative aspect-[3/4] w-[64vw] max-w-[280px] shrink-0 snap-center overflow-hidden rounded-md ${index % 3 === 1 ? "sm:translate-y-8" : ""} ${className ?? ""}`}
  >
    <img
      src={student.image}
      alt={student.name ? t("homepage.students.namedAlt", { name: student.name, destination: student.destination }) : t("homepage.students.alt", { destination: student.destination })}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
      style={{ objectPosition: student.focus || "50% 40%" }}
    />
    <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/5 to-transparent" />
    <figcaption className="absolute inset-x-0 bottom-0 p-4 text-primary-foreground">
      {student.name ? <p className="font-bold">{student.name}</p> : null}
      <p className="text-sm text-primary-foreground/70">{student.destination}</p>
    </figcaption>
  </figure>
);

const HomepageExperience = () => {
  const { t } = useTranslation("landing");
  const { isRtl } = useDirection();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const routes = t("homepage.routes.items", { returnObjects: true }) as TextItem[];
  const services = t("homepage.services.items", { returnObjects: true }) as TextItem[];
  const steps = t("homepage.journey.steps", { returnObjects: true }) as TextItem[];
  const students = t("studentGallery.students", { returnObjects: true }) as GalleryStudent[];
  const included = t("homepage.scope.included", { returnObjects: true }) as string[];
  const decisions = t("homepage.scope.decisions", { returnObjects: true }) as string[];
  const faqs = t("homepage.faq.items", { returnObjects: true }) as TextItem[];
  // Keep the gallery slices available for any cached/deployed module version
  // that still references the earlier homepage gallery structure.
  const half = Math.ceil(students.length / 2);
  const topStudents = students.slice(0, half);
  const bottomStudents = students.slice(half);
  const [activeStep, setActiveStep] = useState(0);
  const [activeService, setActiveService] = useState(0);
  const [activeLevel, setActiveLevel] = useState("C1");
  const [activeExam, setActiveExam] = useState("TestDaF");
  const levelDetails = t("homepage.languagePrep.levels", { returnObjects: true }) as Record<string, { label: string; description: string; hours: string; duration: string }>;
  const examDetails = t("homepage.languagePrep.exams", { returnObjects: true }) as Record<string, { label: string; description: string }>;

  return (
    <div className="homepage-experience">
      <section className="darb-home-hero relative flex items-center overflow-hidden bg-primary text-primary-foreground">
        <img
          src={germanyHero}
          alt={t("homepage.hero.imageAlt")}
          fetchPriority="high"
          decoding="async"
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-primary/10" />

        <div className="darb-home-hero-content container relative z-10 mx-auto flex w-full justify-center px-4">
          <div className="darb-home-hero-panel bg-primary/80 text-center shadow-surface-lg backdrop-blur-[2px]">
            <p className="darb-home-hero-eyebrow font-semibold text-primary-foreground/90">{t("homepage.hero.eyebrow")}</p>
            <h1 className="darb-home-hero-title mx-auto mt-3 max-w-2xl font-bold leading-[1.15] text-primary-foreground">
              {t("homepage.hero.title")}
            </h1>
            <p className="darb-home-hero-subtitle mx-auto mt-5 max-w-2xl leading-8 text-primary-foreground/90">
              {t("homepage.hero.subtitle")}
            </p>
            <div className="darb-home-hero-actions flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent" className="darb-home-hero-button rounded-md text-base shadow-[0_8px_24px_-12px_hsl(var(--brand)/0.65)]">
                <Link to="/apply">{t("homepage.actions.apply")}<Arrow className="h-5 w-5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="darb-home-hero-button rounded-md border-primary-foreground/35 bg-primary/10 text-base text-primary-foreground backdrop-blur-sm hover:bg-primary-foreground hover:text-primary">
                <a
                  href={whatsappBusinessUrl("مرحبا، بدي أعرف أكثر عن الدراسة بألمانيا مع درب.")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-5 w-5" />{t("homepage.actions.whatsapp")}
                </a>
              </Button>
            </div>
            <p className="mt-5 flex items-center justify-center gap-2 text-sm text-primary-foreground/75">
              <CircleCheck className="h-4 w-4 text-brand" />{t("homepage.hero.reassurance")}
            </p>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 grid h-3 grid-cols-7" aria-hidden="true">
          <span className="bg-destructive" /><span className="bg-brand" /><span className="bg-trust" /><span className="bg-primary" /><span className="bg-secondary" /><span className="bg-brand" /><span className="bg-primary" />
        </div>
      </section>

      <div className="darb-flight-transition relative h-20 overflow-hidden bg-background" aria-hidden="true">
        <svg className="absolute inset-x-[7%] top-1/2 h-12 w-[86%] -translate-y-1/2" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,90 C220,15 430,15 600,65 S980,115 1200,28" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 10" className="text-border" />
        </svg>
        <div className="darb-flight-plane absolute left-[7%] top-1/2 -translate-y-1/2 text-brand" aria-hidden="true">
          <Plane className="h-5 w-5" />
        </div>
      </div>

      <section aria-labelledby="homepage-network-title" className="darb-network-section overflow-hidden border-y border-border bg-background text-primary">
        <div className="container py-12 sm:py-14 lg:py-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-brand-strong">{t("homepage.network.eyebrow")}</p>
              <h2 id="homepage-network-title" className="mt-2 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">
                {t("homepage.network.title")}
              </h2>
            </div>
            <div className="hidden shrink-0 rounded-full border border-border bg-editorial-paper px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-muted-foreground sm:block">
              {t("homepage.network.badge")}
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">{t("homepage.network.tu9Label")}</p>
              <a href="https://www.tu9.de/en/" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-strong transition-colors hover:text-brand">
                {t("homepage.network.viewTu9")}
              </a>
            </div>

            <div className="darb-logo-marquee rounded-md border border-border bg-background" dir="ltr" aria-label={t("homepage.network.tu9Label")}>
              <div className="darb-logo-marquee-track">
                {[...tu9Universities, ...tu9Universities].map((uni, index) => {
                  const isPrimarySet = index < tu9Universities.length;
                  return (
                    <a
                      key={`${uni.name}-${index}`}
                      href={uni.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={uni.name}
                      className="darb-logo-tile group"
                      tabIndex={isPrimarySet ? 0 : -1}
                      aria-hidden={isPrimarySet ? undefined : true}
                    >
                      <div className="flex h-14 w-full items-center justify-center sm:h-16">
                        <img
                          src={uni.logoUrl}
                          alt={isPrimarySet ? uni.name : ""}
                          loading={isPrimarySet ? "eager" : "lazy"}
                          fetchPriority={isPrimarySet ? "high" : "low"}
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="max-h-11 w-auto max-w-[126px] object-contain opacity-75 transition-all duration-300 group-hover:scale-[1.04] group-hover:opacity-100"
                          onError={(event) => {
                            const image = event.currentTarget;
                            image.style.display = "none";
                            const fallback = image.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.hidden = false;
                          }}
                        />
                        <span hidden className="max-w-[130px] text-center text-xs font-bold leading-4 text-primary">
                          {uni.city}
                        </span>
                      </div>
                      <span className="mt-2 text-[0.62rem] font-semibold tracking-wide text-muted-foreground transition-colors group-hover:text-primary">
                        {uni.city}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-7">
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">{t("homepage.network.schoolsLabel")}</p>
              <Link to="/educational-programs" className="text-xs font-bold text-brand-strong transition-colors hover:text-brand">
                {t("homepage.network.viewSchools")}
              </Link>
            </div>

            <div className="darb-logo-marquee darb-logo-marquee-schools rounded-md border border-border bg-editorial-paper" dir="ltr" aria-label={t("homepage.network.schoolsLabel")}>
              <div className="darb-logo-marquee-track">
                {[...languageYearSchools, ...languageYearSchools].map((school, index) => (
                  <a
                    key={`${school.name}-${index}`}
                    href={school.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={school.name}
                    className="darb-school-logo-tile group"
                  >
                    {school.logoUrl ? (
                      <img
                        src={school.logoUrl}
                        alt={school.name}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="max-h-12 w-auto max-w-[170px] object-contain opacity-80 transition-all duration-300 group-hover:scale-[1.03] group-hover:opacity-100"
                        onError={(event) => {
                          const image = event.currentTarget;
                          image.style.display = "none";
                          const fallback = image.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.hidden = false;
                        }}
                      />
                    ) : null}
                    <span hidden className="max-w-[160px] text-center text-xs font-bold leading-4 text-primary">{school.name}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
            <p className="shrink-0 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">{t("homepage.network.examsLabel")}</p>
            <div className="flex flex-wrap gap-2">
              {ecosystemExams.map((exam) => (
                <span
                  key={exam}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-primary"
                >
                  {exam}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-routes-title" className="bg-background py-14 sm:py-20">
        <div className="container">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-strong">{t("homepage.routes.eyebrow")}</p>
              <h2 id="homepage-routes-title" className="mt-2 text-3xl font-bold leading-tight text-primary sm:text-4xl">{t("homepage.routes.title")}</h2>
            </div>
            <Link to="/apply" className="hidden text-sm font-semibold text-brand-strong sm:inline-flex sm:items-center sm:gap-2">
              {t("homepage.routes.cta")}<Arrow className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {routes.map((route, index) => {
              const Icon = routeIcons[index] ?? Compass;
              return (
                <Link
                  key={route.title}
                  to="/apply"
                  className="group relative min-h-[220px] overflow-hidden rounded-md border border-border bg-editorial-paper p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-surface-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-surface transition-transform duration-300 group-hover:scale-105">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">0{index + 1}</p>
                  <h3 className="mt-2 text-xl font-bold text-primary">{route.title}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{route.description}</p>
                  <Arrow className="absolute bottom-6 end-6 h-5 w-5 text-brand-strong transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-journey-title" className="overflow-hidden bg-editorial-paper py-14 sm:py-20">
        <div className="container">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-strong">{t("homepage.journey.eyebrow")}</p>
              <h2 id="homepage-journey-title" className="mt-2 max-w-3xl text-3xl font-bold leading-tight text-primary sm:text-4xl">{t("homepage.journey.title")}</h2>
            </div>
            <Plane className="hidden h-7 w-7 text-brand sm:block" aria-hidden="true" />
          </div>

          <div className="relative mt-10">
            <div className="absolute left-[6%] right-[6%] top-7 hidden h-px border-t border-dashed border-border md:block" aria-hidden="true" />
            <ol className="grid gap-3 md:grid-cols-4 md:gap-2">
              {steps.map((step, index) => {
                const Icon = journeyIcons[index] ?? Check;
                const isActive = activeStep === index;
                return (
                  <li key={step.title} className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveStep(index)}
                      aria-pressed={isActive}
                      className={isActive ? "group relative w-full rounded-md border border-brand bg-background p-5 text-start shadow-surface-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" : "group relative w-full rounded-md border border-border bg-background p-5 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"}
                    >
                      <div className="flex items-center justify-between">
                        <div className={isActive ? "relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-brand bg-brand text-brand-foreground" : "relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background text-primary"}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className="text-[0.68rem] font-bold tracking-[0.18em] text-brand-strong">0{index + 1}</span>
                      </div>
                      <h3 className="mt-7 text-lg font-bold text-primary">{step.title}</h3>
                      <p className={isActive ? "mt-2 text-sm leading-6 text-muted-foreground opacity-100" : "mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground opacity-65"}>{step.description}</p>
                      <span className={isActive ? "absolute bottom-4 end-4 h-1.5 w-1.5 rounded-full bg-brand scale-125" : "absolute bottom-4 end-4 h-1.5 w-1.5 rounded-full bg-brand scale-75 opacity-40"} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-destinations-title" className="bg-background py-14 sm:py-20">
        <div className="container">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-strong">{t("homepage.destinations.eyebrow")}</p>
              <h2 id="homepage-destinations-title" className="mt-2 text-3xl font-bold leading-tight text-primary sm:text-4xl">{t("homepage.destinations.title")}</h2>
            </div>
            <Link to="/educational-programs" className="hidden text-sm font-semibold text-brand-strong sm:inline-flex sm:items-center sm:gap-2">
              {t("homepage.destinations.cta")}<Arrow className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid auto-rows-[180px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {languageYearCities.map((city, index) => (
              <a
                key={city.id}
                href={city.cityUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`group relative overflow-hidden rounded-md border border-border shadow-surface transition-all duration-500 hover:-translate-y-0.5 hover:shadow-surface-lg ${index === 0 ? "sm:col-span-2 sm:row-span-2" : ""} ${index === 4 ? "sm:col-span-2 lg:col-span-2" : ""}`}
              >
                <img src={city.imageUrl} alt={city.name} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <div className="flex items-center gap-2 text-white/65">
                    <MapPin className="h-4 w-4" />
                    <span className="text-xs font-semibold">{city.region}</span>
                  </div>
                  <div className="flex items-end justify-between gap-3"><h3 className="mt-1 text-2xl font-bold">{city.name}</h3><Arrow className="h-5 w-5 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" /></div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-language-title" className="overflow-hidden bg-primary py-14 text-primary-foreground sm:py-20">
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand">{t("homepage.languagePrep.eyebrow")}</p>
              <h2 id="homepage-language-title" className="mt-2 max-w-xl text-3xl font-bold leading-tight sm:text-4xl">{t("homepage.languagePrep.title")}</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-primary-foreground/65 sm:text-base">{t("homepage.languagePrep.body")}</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-md border border-primary-foreground/10 bg-primary-foreground/[0.035] p-5 shadow-surface-lg sm:p-7">
                <div className="flex items-center justify-between">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-primary-foreground/45">{t("homepage.languagePrep.levelLabel")}</p>
                  <span className="text-xs font-semibold text-brand">{activeLevel}</span>
                </div>
                <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {["A1", "A2", "B1", "B2", "C1"].map((level) => {
                    const isActive = activeLevel === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setActiveLevel(level)}
                        aria-pressed={isActive}
                        className={isActive ? "flex min-w-[58px] flex-1 flex-col items-center rounded-md bg-brand px-2 py-3 text-brand-foreground shadow-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" : "flex min-w-[58px] flex-1 flex-col items-center rounded-md bg-primary-foreground/[0.04] px-2 py-3 text-primary-foreground/65 transition-colors hover:bg-primary-foreground/[0.08] hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"}
                      >
                        <span className="text-sm font-bold">{level}</span>
                        <span className="mt-1 h-px w-full bg-current opacity-20" />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 min-h-[118px] rounded-md border border-primary-foreground/10 bg-background/5 p-4">
                  <p className="text-xs font-bold text-brand">{levelDetails[activeLevel]?.label ?? activeLevel}</p>
                  <p className="mt-2 text-sm leading-6 text-primary-foreground/70">{levelDetails[activeLevel]?.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/10 bg-primary-foreground/[0.04] px-3 py-1.5 text-xs font-semibold text-primary-foreground/80">
                      <span aria-hidden="true">⏱</span>
                      {levelDetails[activeLevel]?.hours}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/[0.08] px-3 py-1.5 text-xs font-semibold text-primary-foreground/80">
                      <span aria-hidden="true">◷</span>
                      {levelDetails[activeLevel]?.duration}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-primary-foreground/10 bg-background p-5 text-primary sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-brand-strong">{t("homepage.languagePrep.examEyebrow")}</p>
                    <h3 className="mt-2 text-xl font-bold">{t("homepage.languagePrep.examTitle")}</h3>
                  </div>
                  <div className="hidden rounded-md bg-editorial-paper px-2.5 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-muted-foreground sm:block">
                    {t("homepage.languagePrep.examBadge")}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {examBrands.map((exam) => {
                    const isActive = activeExam === exam.id;
                    return (
                      <button
                        key={exam.id}
                        type="button"
                        onClick={() => setActiveExam(exam.id)}
                        aria-pressed={isActive}
                        title={exam.subtitle}
                        className={isActive ? "group flex min-h-[86px] flex-col items-center justify-center rounded-md border border-brand bg-editorial-paper px-2 py-3 text-center shadow-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" : "group flex min-h-[86px] flex-col items-center justify-center rounded-md border border-border bg-background px-2 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"}
                      >
                        {exam.logoUrl ? (
                          <img
                            src={exam.logoUrl}
                            alt={exam.label}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="max-h-10 w-auto max-w-[118px] object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                            onError={(event) => {
                              const image = event.currentTarget;
                              image.style.display = "none";
                              const fallback = image.nextElementSibling as HTMLElement | null;
                              if (fallback) fallback.hidden = false;
                            }}
                          />
                        ) : (
                          <span className="text-xl font-black tracking-tight text-primary">{exam.label}</span>
                        )}
                        <span hidden className="max-w-[118px] text-center text-xl font-black tracking-tight text-primary">{exam.label}</span>
                        <span className="mt-2 line-clamp-1 text-[0.56rem] font-medium text-muted-foreground">{exam.subtitle}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-md border border-border bg-editorial-paper/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{examDetails[activeExam]?.label ?? activeExam}</p>
                      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{examDetails[activeExam]?.description}</p>
                    </div>
                    <span className="hidden shrink-0 rounded-full border border-brand/25 bg-brand/[0.07] px-2 py-1 text-[0.58rem] font-bold uppercase tracking-[0.13em] text-brand-strong sm:block">
                      {t("homepage.languagePrep.registrationBadge")}
                    </span>
                  </div>
                  <Link
                    to="/apply"
                    className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-brand-strong transition-all hover:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {t("homepage.languagePrep.examCta")}
                    <Arrow className="h-4 w-4 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-services-title" className="bg-background py-14 sm:py-20">
        <div className="container">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-strong">{t("homepage.services.eyebrow")}</p>
            <h2 id="homepage-services-title" className="mt-2 text-3xl font-bold leading-tight text-primary sm:text-4xl">{t("homepage.services.title")}</h2>
          </div>
          <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {services.map((service, index) => {
              const Icon = serviceIcons[index] ?? Check;
              const isActive = activeService === index;
              return (
                <button
                  key={service.title}
                  type="button"
                  onClick={() => setActiveService(index)}
                  aria-pressed={isActive}
                  className={isActive ? "group min-h-[190px] rounded-md border border-brand bg-editorial-paper p-5 text-start shadow-surface-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:p-6" : "group min-h-[190px] rounded-md border border-border bg-background p-5 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:p-6"}
                >
                  <div className="flex items-center justify-between">
                    <div className={isActive ? "flex h-10 w-10 items-center justify-center rounded-md bg-brand text-brand-foreground" : "flex h-10 w-10 items-center justify-center rounded-md bg-editorial-paper text-brand-strong transition-colors group-hover:bg-brand group-hover:text-brand-foreground"}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[0.68rem] font-bold tracking-[0.18em] text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="mt-9 text-base font-bold text-primary">{service.title}</h3>
                  <p className={isActive ? "mt-2 text-sm leading-6 text-muted-foreground" : "mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground opacity-55"}>
                    {service.description}
                  </p>
                  <span className={isActive ? "mt-4 block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-brand-strong" : "mt-4 block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted-foreground/60"}>
                    {isActive ? t("homepage.services.selected") : t("homepage.services.explore")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-students-title" className="overflow-hidden bg-primary py-14 text-primary-foreground sm:py-20">
        <div className="container grid items-center gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand">{t("homepage.students.eyebrow")}</p>
            <h2 id="homepage-students-title" className="mt-2 max-w-lg text-3xl font-bold leading-tight sm:text-4xl">{t("homepage.students.title")}</h2>
            <Button asChild variant="outline" className="mt-7 rounded-md border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              <Link to="/apply">{t("homepage.actions.checkProfile")}<Arrow className="h-4 w-4" /></Link>
            </Button>
          </div>

          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
            {topStudents.map((student, index) => (
              <StudentFigure key={`${student.image}-top-${index}`} student={student} index={index} t={t} />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-trust-title" className="bg-editorial-paper py-14 sm:py-20">
        <div className="container">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-strong">{t("homepage.trust.eyebrow")}</p>
            <h2 id="homepage-trust-title" className="mt-2 text-3xl font-bold leading-tight text-primary sm:text-4xl">{t("homepage.trust.title")}</h2>
          </div>
          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
              <div className="flex items-center gap-3">
                <CircleCheck className="h-6 w-6 text-brand" />
                <h3 className="text-lg font-bold">{t("homepage.scope.includedTitle")}</h3>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {included.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-primary-foreground/75">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-background p-6 shadow-surface sm:p-8">
              <div className="flex items-center gap-3">
                <Building2 className="h-6 w-6 text-brand-strong" />
                <h3 className="text-lg font-bold text-primary">{t("homepage.scope.decisionsTitle")}</h3>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {decisions.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-pricing-title" className="bg-background py-14 sm:py-20">
        <div className="container">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-strong">{t("homepage.pricing.eyebrow")}</p>
              <h2 id="homepage-pricing-title" className="mt-2 text-3xl font-bold text-primary sm:text-4xl">{t("homepage.pricing.title")}</h2>
            </div>
            <CircleCheck className="hidden h-7 w-7 text-trust sm:block" aria-hidden="true" />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["assess", "breakdown", "payment"].map((key, index) => (
              <div key={key} className="rounded-2xl border border-border bg-editorial-paper p-6">
                <p className="text-3xl font-bold text-brand-strong">0{index + 1}</p>
                <h3 className="mt-8 font-bold text-primary">{t(`homepage.pricing.${key}Title`)}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-faq-title" className="overflow-hidden bg-editorial-paper py-14 sm:py-20">
        <div className="container grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-strong">{t("homepage.faq.eyebrow")}</p>
            <h2 id="homepage-faq-title" className="mt-2 max-w-lg text-3xl font-bold leading-tight text-primary sm:text-4xl">{t("homepage.faq.title")}</h2>
          </div>
          <Accordion type="single" collapsible className="border-t border-border">
            {faqs.map((item, index) => (
              <AccordionItem key={item.title} value={`faq-${index}`}>
                <AccordionTrigger className="text-start text-base font-bold text-primary hover:no-underline sm:text-lg">{item.title}</AccordionTrigger>
                <AccordionContent className="pe-8 text-sm leading-7 text-muted-foreground">{item.description}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="container flex flex-col gap-6 py-14 sm:py-16 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand">{t("homepage.final.eyebrow")}</p>
            <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{t("homepage.final.title")}</h2>
          </div>
          <Button asChild size="lg" variant="accent" className="rounded-md">
            <Link to="/apply">{t("homepage.routes.cta")}<Arrow className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

    </div>
  );
};

export default HomepageExperience;
