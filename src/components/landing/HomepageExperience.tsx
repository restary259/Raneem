import { Link } from "@/lib/router-compat";
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
const ecosystemExams = ["TestDaF", "telc", "TestAS", "DSH", "IELTS", "TOEFL", "OnSET"];

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
    className={`relative aspect-[3/4] w-[64vw] max-w-[280px] shrink-0 snap-center overflow-hidden rounded-2xl ${index % 3 === 1 ? "sm:translate-y-8" : ""} ${className ?? ""}`}
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
              <Button asChild size="lg" variant="accent" className="darb-home-hero-button rounded-none text-base">
                <Link to="/apply">{t("homepage.actions.apply")}<Arrow className="h-5 w-5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="darb-home-hero-button rounded-none border-primary-foreground/50 bg-primary/50 text-base text-primary-foreground hover:bg-primary-foreground hover:text-primary">
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

      <section aria-labelledby="homepage-network-title" className="overflow-hidden bg-primary text-primary-foreground">
        <div className="container py-12 sm:py-14 lg:py-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-brand">{t("homepage.network.eyebrow")}</p>
              <h2 id="homepage-network-title" className="mt-2 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">
                {t("homepage.network.title")}
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-primary-foreground/60 sm:text-end">{t("homepage.network.body")}</p>
          </div>

          <div className="mt-9">
            <div className="flex items-center justify-between">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-primary-foreground/45">{t("homepage.network.tu9Label")}</p>
              <a href="https://www.tu9.de/en/" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand hover:opacity-80">{t("homepage.network.viewTu9")}</a>
            </div>
            <div className="mt-4 -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-9 lg:overflow-visible lg:px-0">
              {tu9Universities.map((uni) => (
                <a
                  key={uni.name}
                  href={uni.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={uni.name}
                  className="group flex min-w-[112px] snap-start flex-col items-center justify-center rounded-xl border border-primary-foreground/10 bg-primary-foreground/[0.035] px-2 py-4 transition-colors hover:border-brand/40 hover:bg-primary-foreground/[0.07] lg:min-w-0"
                >
                  <div className="flex h-12 w-full items-center justify-center">
                    <img src={uni.logoUrl} alt={uni.name} loading="lazy" decoding="async" className="max-h-10 w-auto max-w-[100px] object-contain opacity-70 brightness-0 invert transition-opacity group-hover:opacity-100" />
                  </div>
                  <span className="mt-2 text-[0.66rem] font-semibold tracking-wide text-primary-foreground/55 group-hover:text-primary-foreground/90">{uni.city}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-primary-foreground/10 pt-7">
            <div className="flex items-center justify-between">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-primary-foreground/45">{t("homepage.network.schoolsLabel")}</p>
              <Link to="/educational-programs" className="text-xs font-semibold text-brand hover:opacity-80">{t("homepage.network.viewSchools")}</Link>
            </div>
            <div className="mt-4 -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0">
              {languageYearSchools.map((school) => (
                <a
                  key={school.name}
                  href={school.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={school.name}
                  className="group flex min-w-[150px] snap-start items-center justify-center rounded-xl bg-background px-3 py-4 transition-transform hover:-translate-y-0.5 hover:shadow-surface lg:min-w-0"
                >
                  {school.logoUrl ? (
                    <img src={school.logoUrl} alt={school.name} loading="lazy" decoding="async" className="max-h-12 w-auto max-w-[150px] object-contain" />
                  ) : (
                    <span className="text-sm font-semibold text-primary">{school.name}</span>
                  )}
                </a>
              ))}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-primary-foreground/10 pt-6">
            <p className="me-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary-foreground/40">{t("homepage.network.examsLabel")}</p>
            {ecosystemExams.map((exam) => (
              <span key={exam} className="rounded-full border border-primary-foreground/15 bg-primary-foreground/[0.04] px-3 py-1.5 text-xs font-semibold text-primary-foreground/75">
                {exam}
              </span>
            ))}
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
                  className="group relative min-h-[220px] overflow-hidden rounded-2xl border border-border bg-editorial-paper p-6 transition-all hover:-translate-y-1 hover:shadow-surface-lg"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
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
            <ol className="grid gap-4 md:grid-cols-4 md:gap-2">
              {steps.map((step, index) => {
                const Icon = journeyIcons[index] ?? Check;
                return (
                  <li key={step.title} className="relative rounded-2xl border border-border bg-background p-5">
                    <div className="flex items-center justify-between">
                      <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-background text-primary shadow-surface">
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="text-[0.68rem] font-bold tracking-[0.18em] text-brand-strong">0{index + 1}</span>
                    </div>
                    <h3 className="mt-8 text-lg font-bold text-primary">{step.title}</h3>
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
                className={`group relative overflow-hidden rounded-2xl ${index === 0 ? "sm:col-span-2 sm:row-span-2" : ""} ${index === 4 ? "sm:col-span-2 lg:col-span-2" : ""}`}
              >
                <img src={city.imageUrl} alt={city.name} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <div className="flex items-center gap-2 text-white/65">
                    <MapPin className="h-4 w-4" />
                    <span className="text-xs font-semibold">{city.region}</span>
                  </div>
                  <h3 className="mt-1 text-2xl font-bold">{city.name}</h3>
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
            <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/[0.035] p-5 sm:p-7">
              <div className="flex items-end justify-between gap-2">
                {["A1", "A2", "B1", "B2", "C1"].map((level, index) => (
                  <div key={level} className="flex-1 text-center">
                    <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border ${index === 4 ? "border-brand bg-brand text-brand-foreground" : "border-primary-foreground/20 bg-primary-foreground/[0.04]"}`}>
                      <span className="text-sm font-bold">{level}</span>
                    </div>
                    {index < 4 ? <div className="mx-auto mt-2 h-px w-full bg-primary-foreground/15" /> : <div className="mt-2 h-px w-full bg-brand/50" />}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {`TestDaF|telc|DSH|OnSET`.split("|").map((exam) => (
                  <span key={exam} className="rounded-full border border-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground/75">{exam}</span>
                ))}
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
          <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {services.map((service, index) => {
              const Icon = serviceIcons[index] ?? Check;
              return (
                <div key={service.title} className="bg-background p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <Icon className="h-6 w-6 text-brand-strong" />
                    <span className="text-[0.68rem] font-bold tracking-[0.18em] text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="mt-10 text-base font-bold text-primary">{service.title}</h3>
                </div>
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
