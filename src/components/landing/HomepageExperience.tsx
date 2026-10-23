import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import BrandArch from "@/components/landing/home/BrandArch";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleCheck,
  FileCheck2,
  Home,
  MapPin,
  MessageCircle,
  Plane,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { whatsappBusinessUrl } from "@/lib/contactConfig";
import { useDirection } from "@/hooks/useDirection";
import germanyHero from "@/assets/germany-home-hero.jpg";
import goetheLogo from "@/assets/exams/goethe.svg.asset.json";
import dshAuthorityLogo from "@/assets/exams/hrk.svg.asset.json";
import telcLogo from "@/assets/exams/telc.svg.asset.json";
import testAsLogo from "@/assets/exams/testas.svg.asset.json";
import testDafLogo from "@/assets/exams/testdaf.svg.asset.json";
import { activeLanguageYearCities, tu9Universities } from "@/data/educationalDestinations";
import IdentityStage from "./home/IdentityStage";
import CefrGuide from "./home/CefrGuide";
import ExamFlipCard from "./home/ExamFlipCard";

type TextItem = { title: string; description: string };
type GalleryStudent = { name: string; destination: string; image: string; focus?: string };

const journeyIcons = [SearchCheck, FileCheck2, ShieldCheck, Home, Plane];

const examBrands = [
  { id: "TestDaF", label: "TestDaF", website: "https://www.testdaf.de/", logo: testDafLogo.url },
  { id: "telc", label: "telc Deutsch C1 Hochschule", website: "https://www.telc.net/sprachpruefungen/zertifikatspruefung/deutsch/telc-deutsch-c1-hochschule/", logo: telcLogo.url, logoOnDark: true },
  { id: "Goethe", label: "Goethe-Zertifikat", website: "https://www.goethe.de/en/spr/prf.html", logo: goetheLogo.url },
  { id: "DSH", label: "DSH-2", website: "https://www.hrk.de/themen/internationales/internationale-studierende-und-forschende/hochschulzugang-fuer-internationale-studierende/sprachnachweis-deutsch", logo: dshAuthorityLogo.url },
  { id: "TestAS", label: "TestAS", website: "https://www.testas.de/en/", logo: testAsLogo.url },
];

const StudentStory = ({ student, t }: {
  student: GalleryStudent;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => (
  <figure className="group relative min-w-0 overflow-hidden rounded-2xl bg-muted">
    <div className="aspect-[4/5] overflow-hidden sm:aspect-[4/3]">
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
    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary via-primary/75 to-transparent p-4 pt-14 text-primary-foreground sm:p-5 sm:pt-16">
      {student.name ? <p className="font-bold">{student.name}</p> : null}
      <p className="mt-1 flex items-center gap-1.5 text-sm text-primary-foreground/75">
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
  const [openExam, setOpenExam] = useState<string | null>(null);

  return (
    <div className="homepage-experience bg-background">
      <section className="darb-home-hero relative overflow-hidden bg-editorial-paper" aria-labelledby="homepage-hero-title">
        <img
          src={germanyHero}
          alt={t("homepage.hero.imageAlt")}
          fetchPriority="high"
          decoding="async"
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <span aria-hidden="true" className="darb-hero-scrim absolute inset-0" />
        <div className="darb-home-hero-content relative z-10 flex min-h-full w-full min-w-0 items-center justify-center">
          <div className="darb-home-hero-panel bg-hero-panel/45 text-center text-primary-foreground">
            <p className="darb-home-hero-eyebrow mb-4 font-bold uppercase">{t("homepage.hero.eyebrow")}</p>
            <h1 id="homepage-hero-title" className="darb-home-hero-title text-balance font-editorial font-light leading-[1.08] tracking-tight">
              {t("homepage.hero.title")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-primary-foreground/80 sm:text-lg">
              {t("homepage.explained.body")}
            </p>
            <div className="darb-home-hero-actions flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="cta" className="bg-brand! text-base text-brand-foreground! shadow-surface-lg hover:bg-brand/90!">
                <Link to="/apply">{t("homepage.actions.apply")}<Arrow /></Link>
              </Button>
            </div>
            <p className="darb-home-hero-reassurance text-center text-sm font-medium text-primary-foreground/75">
              <CircleCheck aria-hidden="true" className="me-1.5 inline-block size-4 shrink-0 align-[-0.18em] text-brand" />
              {t("homepage.hero.reassurance")}
            </p>
          </div>
        </div>
        <span aria-hidden="true" className="darb-spectrum darb-spectrum-lg absolute inset-x-0 bottom-0 z-20 rounded-none" />
      </section>

      <section aria-labelledby="homepage-services-title" className="bg-background py-14 sm:py-20">
        <div className="container">
          <div className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[0.68fr_1.32fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("homepage.services.eyebrow")}</p>
              <h2 id="homepage-services-title" className="mt-3 text-balance text-3xl font-bold leading-tight text-primary sm:text-4xl">
                {t("homepage.services.title")}
              </h2>
            </div>
            <p className="max-w-2xl leading-7 text-muted-foreground lg:justify-self-end">{t("homepage.services.body")}</p>
          </div>

          <div className="mx-auto mt-9 max-w-4xl">
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 gap-y-0 sm:gap-x-5>
              {services.map((service, index) => {
                const Icon = journeyIcons[index] ?? CircleCheck;
                return (
                  <div key={service.title} className="contents">
                    <div className="relative flex justify-center" aria-hidden="true">
                      <span className="relative z-10 grid size-10 place-items-center rounded-full border border-border bg-background text-brand-strong shadow-quiet">
                        <Icon className="size-4.5" />
                      </span>
                      {index < services.length ? <span className="absolute inset-y-10 w-px bg-border" /> : null}
                    </div>
                    <article className="min-w-0 border-b border-border pb-6 pt-1 last:border-b-0 sm:pb-7">
                      <div className="flex items-start gap-3">
                        <span className="pt-0.5 text-xs font-bold tabular-nums text-brand-strong">{String(index + 1).padStart(2, "0")}</span>
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-primary sm:text-xl">{service.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{service.description}</p>
                        </div>
                      </div>
                    </article>
                  </div>
                );
              })}
              <div className="relative flex justify-center" aria-hidden="true">
                <span className="relative z-10 grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-4.5" />
                </span>
              </div>
              <article className="min-w-0 pb-1 pt-1">
                <p className="text-xs font-bold text-brand-strong">{String(services.length + 1).padStart(2, "0")}</p>
                <h3 className="mt-1 text-lg font-bold text-primary sm:text-xl">{t("homepage.path.arrivalTitle")}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("homepage.path.arrivalBody")}</p>
              </article>
            </div>
            <div className="mt-6 flex justify-end border-t border-border pt-4">
              <Link to="/services" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-strong focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                {t("nav.services")}<Arrow className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-students-title" className="relative overflow-hidden bg-primary py-14 text-primary-foreground sm:py-20">
        <BrandArch variant="frame" className="opacity-30" />
        <div className="container relative z-10">
          <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{t("homepage.students.eyebrow")}</p>
              <h2 id="homepage-students-title" className="mt-3 text-balance text-3xl font-bold leading-tight sm:text-4xl">{t("homepage.students.title")}</h2>
            </div>
            <p className="max-w-2xl leading-7 text-primary-foreground/70 lg:justify-self-end">{t("homepage.students.body")}</p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {students.slice(0, 5).map((student, index) => (
              <StudentStory key={student.image + "-" + index} student={student} t={t} />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-destinations-title" className="bg-editorial-paper py-14 sm:py-20">
        <div className="container">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("homepage.destinations.eyebrow")}</p>
              <h2 id="homepage-destinations-title" className="mt-3 text-3xl font-bold text-primary sm:text-4xl">{t("homepage.destinations.title")}</h2>
            </div>
            <Link to="/educational-destinations" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-strong">
              {t("homepage.destinations.cta")}<Arrow className="size-4" />
            </Link>
          </div>
          <div className="mt-8 grid auto-rows-[190px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {activeLanguageYearCities.slice(0, 5).map((city, index) => (
              <Link
                key={city.id}
                to={city.id === "heidelberg" ? "/heidelberg" : "/educational-destinations"}
                className={[
                  "group relative overflow-hidden rounded-2xl bg-muted transition-transform duration-200 ease-[var(--ease-out)] active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none",
                  index === 0 ? "sm:col-span-2 sm:row-span-2" : "",
                  index === 4 ? "sm:col-span-2" : "",
                ].filter(Boolean).join(" ")}
              >
                <img
                  src={city.imageUrl}
                  alt={city.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 ease-[var(--ease-out)] group-hover:scale-105 motion-reduce:transition-none"
                  onError={(event) => { if (event.currentTarget.src !== germanyHero) event.currentTarget.src = germanyHero; }}
                />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-primary-foreground">
                  <p className="text-xs text-primary-foreground/65">{city.region}</p>
                  <h3 className="mt-1 text-2xl font-bold">{city.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-ecosystem-title" className="bg-background py-14 sm:py-20">
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-[0.65fr_1.35fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("homepage.network.eyebrow")}</p>
              <h2 id="homepage-ecosystem-title" className="mt-3 text-balance text-3xl font-bold leading-tight text-primary sm:text-4xl">{t("homepage.network.title")}</h2>
              <p className="mt-4 max-w-lg leading-7 text-muted-foreground">{t("homepage.network.body")}</p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                {["language", "admission", "assessment", "recognition"].map((key) => (
                  <div key={key} className="border-s-2 border-brand bg-editorial-paper px-3 py-3 text-sm font-bold text-primary">
                    {t("homepage.network.pillars." + key)}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-8">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-bold text-primary">{t("homepage.network.tu9Label")}</h3>
                  <a href="https://www.tu9.de/en/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs font-bold text-brand-strong">
                    {t("homepage.network.viewTu9")}
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
                  {tu9Universities.map((uni) => <IdentityStage key={uni.name} name={uni.name} imageUrl={uni.logoUrl} href={uni.url} meta={uni.city} />)}
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-bold text-primary">{t("homepage.network.examsLabel")}</h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {examBrands.map((exam) => (
                    <ExamFlipCard
                      key={exam.id}
                      name={exam.label}
                      logoSrc={exam.logo}
                      logoOnDark={exam.logoOnDark}
                      href={exam.website}
                      description={t("homepage.languagePrep.exams." + exam.id + ".verifiedDescription")}
                      caveat={t("homepage.languagePrep.exams." + exam.id + ".caveat")}
                      officialLabel={t("homepage.languagePrep.officialPortal")}
                      flipLabel={t("homepage.languagePrep.flipCue")}
                      backLabel={t("homepage.languagePrep.flipBack")}
                      open={openExam === exam.id}
                      onOpen={() => setOpenExam(exam.id)}
                      onClose={() => setOpenExam(null)}
                    />
                  ))}
                </div>
              </div>
              <CefrGuide />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-trust-title" className="bg-editorial-paper py-14 sm:py-20">
        <div className="container">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("homepage.trust.eyebrow")}</p>
            <h2 id="homepage-trust-title" className="mt-3 text-balance text-3xl font-bold text-primary sm:text-4xl">{t("homepage.trust.title")}</h2>
          </div>
          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            <article className="bg-primary p-6 text-primary-foreground sm:p-8">
              <div className="flex items-center gap-3">
                <CircleCheck aria-hidden="true" className="size-6 text-brand" />
                <h3 className="text-xl font-bold">{t("homepage.scope.includedTitle")}</h3>
              </div>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-primary-foreground/75">
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />{item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="border border-border bg-background p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <Building2 aria-hidden="true" className="size-6 text-brand-strong" />
                <h3 className="text-xl font-bold text-primary">{t("homepage.scope.decisionsTitle")}</h3>
              </div>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {decisions.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />{item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {["assess", "breakdown", "payment"].map((key, index) => (
              <article key={key} className="border-t-2 border-t-brand bg-background p-5 sm:p-6">
                <p className="text-xs font-bold tabular-nums text-brand-strong">{String(index + 1).padStart(2, "0")}</p>
                <h3 className="mt-3 text-lg font-bold text-primary">{t("homepage.pricing." + key + "Title")}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("homepage.pricing." + key + "Body")}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-faq-title" className="bg-background py-14 sm:py-20">
        <div className="container grid gap-9 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("homepage.faq.eyebrow")}</p>
            <h2 id="homepage-faq-title" className="mt-3 text-balance text-3xl font-bold text-primary sm:text-4xl">{t("homepage.faq.title")}</h2>
            <p className="mt-4 max-w-md leading-7 text-muted-foreground">{t("homepage.faq.body")}</p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/faq">{t("homepage.faq.all")}<Arrow /></Link>
            </Button>
          </div>
          <Accordion type="single" collapsible className="border-t border-border">
            {faqs.map((item, index) => (
              <AccordionItem key={item.title} value={"faq-" + index}>
                <AccordionTrigger className="text-start text-base font-bold text-primary hover:no-underline sm:text-lg">{item.title}</AccordionTrigger>
                <AccordionContent className="pe-8 text-sm leading-7 text-muted-foreground">{item.description}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section aria-labelledby="homepage-final-title" className="relative overflow-hidden border-t border-border bg-background text-primary">
        <BrandArch className="opacity-10" />
        <div className="container relative z-10 grid gap-7 py-14 sm:py-18 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{t("homepage.final.eyebrow")}</p>
            <h2 id="homepage-final-title" className="mt-3 text-balance font-editorial text-3xl leading-tight sm:text-4xl">{t("homepage.final.title")}</h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">{t("homepage.final.body")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button asChild size="lg" variant="cta">
              <Link to="/apply">{t("homepage.actions.startAssessment")}<Arrow /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <a href={whatsappBusinessUrl("مرحبا، بدي أعرف شو خطوتي الجاية للدراسة بألمانيا.")} target="_blank" rel="noopener noreferrer">
                <MessageCircle />{t("homepage.actions.whatsapp")}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomepageExperience;
