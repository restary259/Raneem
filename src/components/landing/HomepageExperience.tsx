import { useState } from "react";
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
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { whatsappBusinessUrl } from "@/lib/contactConfig";
import { useDirection } from "@/hooks/useDirection";
import { activeLanguageYearCities } from "@/data/educationalDestinations";

type TextItem = { title: string; description: string };
type GalleryStudent = { name: string; destination: string; image: string; focus?: string };
type LanguageLevel = { label: string; group: string; canDo: string };

const serviceIcons = [GraduationCap, FileCheck2, ShieldCheck, Home, MapPin];

const StudentPhoto = ({
  student,
  t,
  className = "",
  priority = false,
}: {
  student: GalleryStudent;
  t: (key: string, options?: Record<string, unknown>) => string;
  className?: string;
  priority?: boolean;
}) => (
  <figure className={"group relative min-w-0 overflow-hidden rounded-[1.5rem] bg-muted " + className}>
    <img
      src={student.image}
      alt={student.name
        ? t("homepage.students.namedAlt", { name: student.name, destination: student.destination })
        : t("homepage.students.alt", { destination: student.destination })}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.03] motion-reduce:transition-none"
      style={{ objectPosition: student.focus || "50% 40%" }}
      onError={(event) => { event.currentTarget.hidden = true; }}
    />
    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary via-primary/75 to-transparent px-3 pb-3 pt-12 text-primary-foreground sm:px-4 sm:pb-4">
      {student.name ? <p className="text-sm font-semibold">{student.name}</p> : null}
      <p className="mt-1 flex items-center gap-1.5 text-xs text-primary-foreground/80">
        <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
        {student.destination}
      </p>
    </figcaption>
  </figure>
);

const HomepageExperience = () => {
  const { t, i18n } = useTranslation("landing");
  const { isRtl } = useDirection();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const services = t("homepage.services.items", { returnObjects: true }) as TextItem[];
  const journeySteps = t("homepage.journey.steps", { returnObjects: true }) as TextItem[];
  const students = t("studentGallery.students", { returnObjects: true }) as GalleryStudent[];
  const included = t("homepage.scope.included", { returnObjects: true }) as string[];
  const decisions = t("homepage.scope.decisions", { returnObjects: true }) as string[];
  const pricingPoints = [
    { title: t("homepage.pricing.assessTitle"), description: t("homepage.pricing.assessBody") },
    { title: t("homepage.pricing.breakdownTitle"), description: t("homepage.pricing.breakdownBody") },
    { title: t("homepage.pricing.paymentTitle"), description: t("homepage.pricing.paymentBody") },
  ];
  const faqs = t("homepage.faq.items", { returnObjects: true }) as TextItem[];
  const levels = t("homepage.languagePrep.levels", { returnObjects: true }) as Record<string, LanguageLevel>;
  const [selectedLevel, setSelectedLevel] = useState("A1");
  const [openFaq, setOpenFaq] = useState<string | undefined>();
  const activeLevel = levels[selectedLevel];
  const featuredCity = activeLanguageYearCities[0];
  const whatsappMessage = i18n.language.startsWith("ar")
    ? "مرحبا، بدي أعرف شو خطوتي الجاية للدراسة بألمانيا."
    : i18n.language.startsWith("he")
      ? "שלום, אשמח לדעת מה הצעד הבא שלי ללימודים בגרמניה."
      : "Hello, I’d like to know my next step toward studying in Germany.";
  const whatsappUrl = whatsappBusinessUrl(whatsappMessage);

  return (
    <div className="homepage-experience bg-background">
      <section aria-labelledby="homepage-hero-title" className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_82%_18%,rgba(11,120,255,0.25),transparent_45%),radial-gradient(ellipse_at_12%_88%,rgba(0,175,199,0.16),transparent_42%)]" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-highlight/80 to-transparent" />

        <div className="container relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-10 sm:gap-14 sm:px-6 sm:pb-20 sm:pt-16 lg:min-h-[610px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-14">
          <div className="relative z-10 max-w-2xl text-start">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/[0.06] px-3.5 py-2 text-xs font-semibold sm:text-sm">
              <span aria-hidden="true" className="size-2 rounded-full bg-highlight" />
              <span>{t("homepage.hero.eyebrow")}</span>
            </div>
            <p className="mb-2 text-sm font-bold tracking-wide text-highlight sm:text-base">{t("homepage.brandSlogan")}</p>
            <h1 id="homepage-hero-title" className="max-w-2xl text-balance text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
              {t("homepage.hero.title")}
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-primary-foreground/80 sm:text-lg sm:leading-8">
              {t("homepage.services.body")}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="cta" className="min-h-12 rounded-full bg-highlight px-6 font-bold text-highlight-foreground hover:bg-highlight/90 sm:px-7">
                <Link to="/apply">{t("homepage.actions.startAssessment")}<Arrow aria-hidden="true" /></Link>
              </Button>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-primary-foreground/30 px-5 text-sm font-semibold text-primary-foreground transition-colors hover:border-primary-foreground/60 hover:bg-primary-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight">
                <MessageCircle aria-hidden="true" className="size-4" />
                {t("homepage.actions.whatsapp")}
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-primary-foreground/15 pt-5 text-sm text-primary-foreground/75">
              <span className="inline-flex items-center gap-2"><BookOpenCheck aria-hidden="true" className="size-4 text-highlight" />{t("homepage.languagePrep.eyebrow")}</span>
              <span aria-hidden="true" className="hidden size-1 rounded-full bg-primary-foreground/40 sm:block" />
              <span className="inline-flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-4 text-highlight" />{t("homepage.scope.eyebrow")}</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[540px] pb-4 pt-2 sm:pb-6 lg:pb-10 lg:pt-0">
            <div aria-hidden="true" className="absolute -end-3 top-6 h-[72%] w-[72%] rounded-[2rem] border border-highlight/30 sm:-end-5 sm:top-8" />
            {students[0] ? (
              <StudentPhoto
                student={students[0]}
                t={t}
                priority
                className="relative z-10 ms-0 aspect-[5/4] w-[80%] shadow-2xl shadow-black/20 sm:aspect-[4/3] sm:w-[78%] lg:aspect-[4/4.2]"
              />
            ) : (
              <div aria-hidden="true" className="aspect-[4/3] w-[80%] rounded-[1.5rem] bg-primary-foreground/10" />
            )}
            {students[1] ? (
              <StudentPhoto
                student={students[1]}
                t={t}
                className="absolute bottom-0 end-0 z-20 aspect-[3/4] w-[42%] border-4 border-primary shadow-xl shadow-black/25 sm:w-[38%] lg:bottom-2"
              />
            ) : null}
            <div className="absolute start-0 top-0 z-20 inline-flex max-w-[72%] items-center gap-2 rounded-2xl border border-primary-foreground/10 bg-primary-foreground text-primary shadow-xl shadow-black/10">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-s-2xl bg-highlight text-highlight-foreground">
                <GraduationCap className="size-5" />
              </span>
              <span className="py-2 pe-3 text-xs font-semibold leading-5 sm:text-sm">{t("homepage.students.title")}</span>
            </div>
          </div>
        </div>
      </section>

      <div aria-hidden="true" className="grid h-1.5 grid-cols-7">
        <span className="bg-[#0B78FF]" /><span className="bg-[#00AFC7]" /><span className="bg-[#22C55E]" /><span className="bg-[#FFC107]" /><span className="bg-[#FF8A00]" /><span className="bg-[#F83838]" /><span className="bg-[#805CFF]" />
      </div>

      <section id="darb-journey" aria-labelledby="homepage-journey-title" className="bg-background py-14 sm:py-20">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 border-b border-border pb-7 sm:pb-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{t("homepage.journey.eyebrow")}</p>
              <h2 id="homepage-journey-title" className="mt-3 max-w-2xl text-balance text-3xl font-semibold leading-tight text-primary sm:text-4xl lg:text-5xl">{t("homepage.journey.title")}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{t("homepage.journey.body")}</p>
          </div>

          <div className="mt-8 grid gap-x-6 gap-y-8 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-8">
            {journeySteps.map((step, index) => (
              <article key={step.title} className="relative min-w-0 border-t-2 border-primary/15 pt-5">
                <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-brand-strong">
                  <span className="grid size-8 place-items-center rounded-full bg-highlight text-highlight-foreground">{String(index + 1).padStart(2, "0")}</span>
                  <span aria-hidden="true" className="h-px w-7 bg-highlight" />
                </span>
                <h3 className="mt-4 text-xl font-semibold leading-snug text-primary">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.description}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-full border-primary/20 text-primary hover:bg-primary/5">
              <Link to="/services">{t("homepage.services.explore")} {t("homepage.services.title")}<Arrow aria-hidden="true" /></Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full text-primary">
              <Link to="/educational-programs">{t("homepage.actions.checkProfile")}<Arrow aria-hidden="true" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-services-title" className="bg-editorial-paper py-14 sm:py-20">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{t("homepage.services.eyebrow")}</p>
              <h2 id="homepage-services-title" className="mt-3 text-balance text-3xl font-semibold leading-tight text-primary sm:text-4xl">{t("homepage.services.title")}</h2>
            </div>
            <Link to="/services" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-brand-strong hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {t("homepage.services.explore")}<Arrow aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10">
            {services.map((service, index) => {
              const Icon = serviceIcons[index] ?? FileCheck2;
              return (
                <article key={service.title} className="relative min-w-0 border-s border-border ps-4 sm:ps-5">
                  <span className="grid size-10 place-items-center rounded-xl bg-background text-brand-strong shadow-quiet">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-primary">{service.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{service.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-students-title" className="bg-background py-14 sm:py-20">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{t("homepage.students.eyebrow")}</p>
              <h2 id="homepage-students-title" className="mt-3 text-balance text-3xl font-semibold leading-tight text-primary sm:text-4xl">{t("homepage.students.title")}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{t("homepage.students.body")}</p>
            </div>
            <Link to="/educational-destinations" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-strong hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {t("nav.educationalDestinations", { ns: "common" })}<Arrow aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {students.slice(0, 4).map((student, index) => (
              <StudentPhoto key={student.image + "-" + index} student={student} t={t} className="aspect-[4/5] sm:aspect-[3/4]" />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-destinations-title" className="bg-editorial-paper py-12 sm:py-16">
        <div className="container mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-center lg:gap-12">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{t("homepage.destinations.eyebrow")}</p>
            <h2 id="homepage-destinations-title" className="mt-3 text-balance text-3xl font-semibold leading-tight text-primary sm:text-4xl">{t("homepage.destinations.title")}</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">{t("homepage.services.body")}</p>
          </div>
          {featuredCity ? (
            <Link to={featuredCity.id === "heidelberg" ? "/heidelberg" : "/educational-destinations"} className="group relative block min-h-[250px] overflow-hidden rounded-[1.75rem] bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[320px]">
              <img
                src={featuredCity.imageUrl}
                alt={featuredCity.name}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
              />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-primary via-primary/35 to-primary/5" />
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-5 text-primary-foreground sm:p-7">
                <div>
                  <p className="text-xs font-semibold text-primary-foreground/70">{featuredCity.region}</p>
                  <h3 className="mt-1 text-3xl font-semibold sm:text-4xl">{featuredCity.name}</h3>
                </div>
                <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-highlight px-4 text-sm font-bold text-highlight-foreground">
                  {t("homepage.destinations.cta")}<Arrow aria-hidden="true" className="size-4" />
                </span>
              </div>
            </Link>
          ) : (
            <Link to="/educational-destinations" className="inline-flex min-h-14 items-center justify-between rounded-[1.5rem] border border-border bg-background px-5 text-sm font-bold text-brand-strong">
              {t("homepage.destinations.cta")}<Arrow aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>
      </section>

      <section aria-labelledby="homepage-language-title" className="bg-primary py-14 text-primary-foreground sm:py-20">
        <div className="container mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-14">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-highlight">{t("homepage.languagePrep.eyebrow")}</p>
            <h2 id="homepage-language-title" className="mt-3 text-balance text-3xl font-semibold leading-tight sm:text-4xl">{t("homepage.languagePrep.title")}</h2>
            <p className="mt-4 text-sm leading-7 text-primary-foreground/75 sm:text-base">{t("homepage.languagePrep.body")}</p>
            <p className="mt-5 border-s-2 border-highlight ps-4 text-sm leading-6 text-primary-foreground/70">{t("homepage.languagePrep.darbRole")}</p>
            <Link to="/services" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-highlight hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight">
              {t("homepage.languagePrep.examCta")}<Arrow aria-hidden="true" className="size-4" />
            </Link>
          </div>

          <div className="rounded-[1.75rem] border border-primary-foreground/15 bg-primary-foreground/[0.06] p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-primary-foreground/65">{t("homepage.languagePrep.levelLabel")}</p>
                <h3 className="mt-1 text-xl font-semibold sm:text-2xl">{t("homepage.languagePrep.guideTitle")}</h3>
              </div>
              <span className="rounded-full border border-highlight/35 px-3 py-1.5 text-xs font-bold text-highlight">CEFR · A1–C1</span>
            </div>
            <div role="group" aria-label={t("homepage.languagePrep.levelSelector")} dir="ltr" className="mt-5 grid grid-cols-5 gap-2">
              {["A1", "A2", "B1", "B2", "C1"].map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={selectedLevel === level}
                  onClick={() => setSelectedLevel(level)}
                  className={"min-h-11 rounded-xl border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight " + (selectedLevel === level ? "border-highlight bg-highlight text-highlight-foreground" : "border-primary-foreground/20 bg-primary-foreground/[0.04] text-primary-foreground/75 hover:border-highlight/60 hover:text-primary-foreground")}
                >
                  {level}
                </button>
              ))}
            </div>
            {activeLevel ? (
              <div aria-live="polite" className="mt-4 min-h-32 border-t border-primary-foreground/15 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold">{activeLevel.label}</h4>
                  <span className="rounded-full bg-primary-foreground/10 px-3 py-1 text-xs text-primary-foreground/75">{activeLevel.group}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-primary-foreground/80">{activeLevel.canDo}</p>
              </div>
            ) : null}
            <p className="mt-3 text-xs leading-5 text-primary-foreground/60">{t("homepage.languagePrep.cefrNote")}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-primary-foreground/15 pt-3 text-xs text-primary-foreground/65">
              <span>{t("homepage.languagePrep.sourceLabel")}</span>
              <a href="https://www.coe.int/en/web/common-european-framework-reference-languages/table-1-cefr-3.3-common-reference-levels-global-scale" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 font-semibold text-highlight hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight">
                {t("homepage.languagePrep.cefrReferenceLink")}<Arrow aria-hidden="true" className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-scope-title" className="bg-background py-14 sm:py-20">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 border-b border-border pb-7 sm:pb-9 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{t("homepage.scope.eyebrow")}</p>
              <h2 id="homepage-scope-title" className="mt-3 text-balance text-3xl font-semibold leading-tight text-primary sm:text-4xl">{t("homepage.scope.title")}</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{t("homepage.scope.body")}</p>
          </div>

          <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-12">
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

          <div className="mt-10 rounded-[1.5rem] bg-editorial-paper p-5 sm:p-7">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{t("homepage.pricing.eyebrow")}</p>
              <h3 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{t("homepage.pricing.title")}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{t("homepage.pricing.body")}</p>
            </div>
            <div className="mt-6 grid gap-5 border-t border-border pt-6 md:grid-cols-3">
              {pricingPoints.map((point, index) => (
                <article key={point.title} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-highlight text-sm font-bold text-highlight-foreground">{index + 1}</span>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-primary">{point.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{point.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-faq-title" className="bg-editorial-paper py-14 sm:py-20">
        <div className="container mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:gap-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{t("homepage.faq.eyebrow")}</p>
            <h2 id="homepage-faq-title" className="mt-3 text-balance text-3xl font-semibold text-primary sm:text-4xl">{t("homepage.faq.title")}</h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">{t("homepage.faq.body")}</p>
            <Button asChild variant="outline" className="mt-5 rounded-full border-primary/20 text-primary hover:bg-primary/5">
              <Link to="/faq">{t("homepage.faq.all")}<Arrow aria-hidden="true" /></Link>
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

      <section aria-labelledby="homepage-final-title" className="relative isolate overflow-hidden bg-primary text-primary-foreground">
        <div aria-hidden="true" className="absolute inset-y-0 end-0 w-1/3 border-s border-primary-foreground/[0.06] bg-primary-foreground/[0.02]" />
        <div className="container relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-7 px-4 py-14 sm:px-6 sm:py-20 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-highlight">{t("homepage.final.eyebrow")}</p>
            <h2 id="homepage-final-title" className="mt-3 text-balance text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">{t("homepage.final.title")}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-primary-foreground/75 sm:text-base">{t("homepage.final.body")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button asChild size="lg" variant="cta" className="min-h-12 rounded-full bg-highlight text-highlight-foreground hover:bg-highlight/90">
              <Link to="/apply">{t("homepage.actions.startAssessment")}<Arrow aria-hidden="true" /></Link>
            </Button>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-primary-foreground/35 px-5 text-sm font-semibold transition-colors hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight">
              <MessageCircle aria-hidden="true" className="size-4" />{t("homepage.actions.whatsapp")}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomepageExperience;
