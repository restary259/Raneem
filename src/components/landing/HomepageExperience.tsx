import { Link } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleCheck,
  FileCheck2,
  GraduationCap,
  HeartHandshake,
  Home,
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
import { languageYearSchools, tu9Universities } from "@/data/educationalDestinations";

type TextItem = { title: string; description: string };
type GalleryStudent = { name: string; destination: string; image: string; focus?: string };

const serviceIcons = [SearchCheck, FileCheck2, ShieldCheck, Home, HeartHandshake];
const ecosystemExams = ["TestDaF", "telc", "TestAS", "DSH", "IELTS", "TOEFL", "OnSET"];
const journeyIcons = [SearchCheck, FileCheck2, Plane, GraduationCap];

const SectionIntro = ({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) => (
  <div className="max-w-2xl">
    <p className="text-xs font-bold uppercase text-brand-strong">{eyebrow}</p>
    <h2 className="mt-3 text-3xl font-bold leading-tight text-primary sm:text-4xl lg:text-5xl">
      {title}
    </h2>
    <p className="mt-4 text-base leading-8 text-muted-foreground sm:text-lg">{body}</p>
  </div>
);

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
    className={`relative aspect-[3/4] w-[70vw] max-w-[280px] shrink-0 snap-center overflow-hidden rounded-md sm:w-auto sm:max-w-none ${index % 3 === 1 ? "sm:translate-y-8" : ""} ${className ?? ""}`}
  >
    <img
      src={student.image}
      alt={student.name ? t("homepage.students.namedAlt", { name: student.name, destination: student.destination }) : t("homepage.students.alt", { destination: student.destination })}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
      style={{ objectPosition: student.focus || "50% 40%" }}
    />
    <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-transparent to-transparent" />
    <figcaption className="absolute inset-x-0 bottom-0 p-4">
      {student.name ? <p className="font-bold">{student.name}</p> : null}
      <p className="text-sm text-primary-foreground/70">{student.destination}</p>
    </figcaption>
  </figure>
);

const HomepageExperience = () => {
  const { t } = useTranslation("landing");
  const { isRtl } = useDirection();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const services = t("homepage.services.items", { returnObjects: true }) as TextItem[];
  const steps = t("homepage.journey.steps", { returnObjects: true }) as TextItem[];
  const students = t("studentGallery.students", { returnObjects: true }) as GalleryStudent[];
  const half = Math.ceil(students.length / 2);
  const topStudents = students.slice(0, half);
  const bottomStudents = students.slice(half);
  const included = t("homepage.scope.included", { returnObjects: true }) as string[];
  const decisions = t("homepage.scope.decisions", { returnObjects: true }) as string[];
  const parentPoints = t("homepage.parents.points", { returnObjects: true }) as string[];
  const faqs = t("homepage.faq.items", { returnObjects: true }) as TextItem[];

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

      <section aria-labelledby="homepage-network-title" className="overflow-hidden bg-primary text-primary-foreground">
        <div className="container py-14 sm:py-16 lg:py-18">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-brand">
              {t("homepage.network.eyebrow")}
            </p>
            <h2 id="homepage-network-title" className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">
              {t("homepage.network.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-primary-foreground/70 sm:text-base">
              {t("homepage.network.body")}
            </p>
          </div>

          <div className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-primary-foreground/45">
                  {t("homepage.network.tu9Label")}
                </p>
                <p className="mt-1 text-sm text-primary-foreground/60">{t("homepage.network.tu9Hint")}</p>
              </div>
              <a
                href="https://www.tu9.de/en/"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden text-xs font-semibold text-brand transition-opacity hover:opacity-80 sm:block"
              >
                {t("homepage.network.viewTu9")}
              </a>
            </div>
            <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-9 lg:overflow-visible lg:px-0">
              {tu9Universities.map((uni) => (
                <a
                  key={uni.name}
                  href={uni.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-w-[118px] snap-start flex-col items-center justify-center rounded-md border border-primary-foreground/10 bg-primary-foreground/[0.035] px-3 py-4 text-center transition-colors hover:border-brand/40 hover:bg-primary-foreground/[0.07] lg:min-w-0"
                  title={uni.name}
                >
                  <div className="flex h-12 w-full items-center justify-center">
                    <img
                      src={uni.logoUrl}
                      alt={uni.name}
                      loading="lazy"
                      decoding="async"
                      className="max-h-10 w-auto max-w-[105px] object-contain opacity-70 brightness-0 invert transition-opacity group-hover:opacity-100"
                    />
                  </div>
                  <span className="mt-3 line-clamp-2 text-[0.68rem] font-semibold leading-4 text-primary-foreground/60 group-hover:text-primary-foreground/90">
                    {uni.city}
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div className="mt-10 border-t border-primary-foreground/10 pt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-primary-foreground/45">
                  {t("homepage.network.schoolsLabel")}
                </p>
                <p className="mt-1 text-sm text-primary-foreground/60">{t("homepage.network.schoolsHint")}</p>
              </div>
              <a
                href="/educational-programs"
                className="hidden text-xs font-semibold text-brand transition-opacity hover:opacity-80 sm:block"
              >
                {t("homepage.network.viewSchools")}
              </a>
            </div>
            <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0">
              {languageYearSchools.map((school) => (
                <a
                  key={school.name}
                  href={school.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-w-[148px] snap-start items-center justify-center rounded-md bg-background px-4 py-4 transition-shadow hover:shadow-surface lg:min-w-0"
                  title={school.name}
                >
                  {school.logoUrl ? (
                    <img
                      src={school.logoUrl}
                      alt={school.name}
                      loading="lazy"
                      decoding="async"
                      className="max-h-12 w-auto max-w-[145px] object-contain"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-primary">{school.name}</span>
                  )}
                </a>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-primary-foreground/10 pt-7 sm:flex-row sm:items-center sm:gap-5">
            <p className="shrink-0 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-primary-foreground/45">
              {t("homepage.network.examsLabel")}
            </p>
            <div className="flex flex-wrap gap-2">
              {ecosystemExams.map((exam) => (
                <span
                  key={exam}
                  className="rounded-full border border-primary-foreground/15 bg-primary-foreground/[0.04] px-3 py-1.5 text-xs font-semibold text-primary-foreground/75"
                >
                  {exam}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-label={t("homepage.proof.aria")} className="border-b border-border bg-background">
        <div className="container grid grid-cols-2 divide-x divide-border py-7 rtl:divide-x-reverse md:grid-cols-3 md:py-9">
          <div className="px-3 text-center md:px-8">
            <p className="text-3xl font-bold text-primary sm:text-4xl">16+</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("homepage.proof.students")}</p>
          </div>
          <div className="px-3 text-center md:px-8">
            <p className="text-3xl font-bold text-primary sm:text-4xl">6+</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("homepage.proof.partners")}</p>
          </div>
          <div className="col-span-2 mt-6 border-t border-border px-3 pt-6 text-center md:col-span-1 md:mt-0 md:border-s md:border-t-0 md:pt-0">
            <p className="text-2xl font-bold text-primary sm:text-3xl">{t("homepage.proof.arabicTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("homepage.proof.arabicBody")}</p>
          </div>
        </div>
      </section>

      <section className="bg-background py-20 sm:py-28">
        <div className="container">
          <SectionIntro
            eyebrow={t("homepage.services.eyebrow")}
            title={t("homepage.services.title")}
            body={t("homepage.services.body")}
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {services.map((service, index) => {
              const Icon = serviceIcons[index] ?? Check;
              return (
                <article key={service.title} className="bg-background p-6 sm:p-7">
                  <Icon className="h-7 w-7 text-brand-strong" aria-hidden="true" />
                  <h3 className="mt-8 text-lg font-bold text-primary">{service.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{service.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-primary py-20 text-primary-foreground sm:py-28">
        <div className="container grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <p className="text-xs font-bold uppercase text-brand">{t("homepage.students.eyebrow")}</p>
            <h2 className="mt-3 max-w-xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              {t("homepage.students.title")}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-primary-foreground/70 sm:text-lg">
              {t("homepage.students.body")}
            </p>
            <Button asChild variant="outline" className="mt-8 rounded-md border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              <Link to="/apply">
                {t("homepage.actions.checkProfile")}
                <Arrow className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {topStudents.map((student, index) => (
              <StudentFigure key={`${student.image}-${index}`} student={student} index={index} t={t} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-editorial-paper py-20 sm:py-28">
        <div className="container">
          <SectionIntro
            eyebrow={t("homepage.journey.eyebrow")}
            title={t("homepage.journey.title")}
            body={t("homepage.journey.body")}
          />
          <ol className="relative mt-14 grid gap-4 md:grid-cols-4 md:gap-0">
            <div className="absolute inset-x-0 top-7 hidden h-px bg-border md:block" aria-hidden="true" />
            {steps.map((step, index) => {
              const Icon = journeyIcons[index] ?? Check;
              return (
                <li key={step.title} className="relative flex gap-5 bg-editorial-paper py-3 md:block md:px-5 md:py-0">
                  <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-background text-primary shadow-surface">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="md:mt-7">
                    <p className="text-xs font-bold text-brand-strong">{String(index + 1).padStart(2, "0")}</p>
                    <h3 className="mt-2 text-lg font-bold text-primary">{step.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-12">
            <Button asChild variant="accent" className="rounded-md">
              <Link to="/apply">{t("homepage.actions.startAssessment")}<Arrow className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-background py-20 sm:py-28">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <SectionIntro
              eyebrow={t("homepage.scope.eyebrow")}
              title={t("homepage.scope.title")}
              body={t("homepage.scope.body")}
            />
            <div className="mt-9 grid gap-8 sm:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 font-bold text-primary"><CircleCheck className="h-5 w-5 text-trust" />{t("homepage.scope.includedTitle")}</h3>
                <ul className="mt-4 space-y-3">
                  {included.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground"><Check className="mt-1 h-4 w-4 shrink-0 text-trust" />{item}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="flex items-center gap-2 font-bold text-primary"><Building2 className="h-5 w-5 text-brand-strong" />{t("homepage.scope.decisionsTitle")}</h3>
                <ul className="mt-4 space-y-3">
                  {decisions.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-editorial-paper py-20 sm:py-24">
        <div className="container grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <SectionIntro
            eyebrow={t("homepage.pricing.eyebrow")}
            title={t("homepage.pricing.title")}
            body={t("homepage.pricing.body")}
          />
          <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
            {["assess", "breakdown", "payment"].map((key, index) => (
              <div key={key} className="bg-background p-6">
                <p className="text-3xl font-bold text-brand-strong">{String(index + 1).padStart(2, "0")}</p>
                <h3 className="mt-5 font-bold text-primary">{t(`homepage.pricing.${key}Title`)}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{t(`homepage.pricing.${key}Body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-20 sm:py-28">
        <div className="container">
          <div className="mx-auto max-w-4xl">
            <SectionIntro
              eyebrow={t("homepage.parents.eyebrow")}
              title={t("homepage.parents.title")}
              body={t("homepage.parents.body")}
            />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {parentPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 border-s-2 border-trust ps-4 text-sm leading-7 text-primary">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-editorial-paper py-20 sm:py-28">
        <div className="container grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <SectionIntro
            eyebrow={t("homepage.faq.eyebrow")}
            title={t("homepage.faq.title")}
            body={t("homepage.faq.body")}
          />
          <div>
            <Accordion type="single" collapsible className="border-t border-border">
              {faqs.map((item, index) => (
                <AccordionItem key={item.title} value={`faq-${index}`}>
                  <AccordionTrigger className="text-start text-base font-bold text-primary hover:no-underline sm:text-lg">{item.title}</AccordionTrigger>
                  <AccordionContent className="pe-8 text-sm leading-7 text-muted-foreground sm:text-base">{item.description}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <Button asChild variant="link" className="mt-5 h-auto px-0 text-brand-strong">
              <Link to="/faq">{t("homepage.faq.all")}<Arrow className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <section aria-label={t("homepage.students.title")} className="border-t border-border bg-background py-14 sm:py-16">
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-6 lg:px-8">
          {bottomStudents.map((student, index) => (
            <StudentFigure key={`${student.image}-bottom-${index}`} student={student} index={index} t={t} className="!w-[60vw] !max-w-[240px] sm:!w-[240px]" />
          ))}
        </div>
      </section>

 </div>
  );
};

export default HomepageExperience;