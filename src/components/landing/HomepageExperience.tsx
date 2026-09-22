import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Building2,
  Check,
  CircleCheck,
  Compass,
  FileCheck2,
  GraduationCap,
  Home,
  Languages,
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
import { languageYearCities, tu9Universities } from "@/data/educationalDestinations";
import BrandArch from "./home/BrandArch";
import IdentityStage from "./home/IdentityStage";
import CefrGuide from "./home/CefrGuide";
import ExamFlipCard from "./home/ExamFlipCard";

type TextItem = { title: string; description: string };
type GalleryStudent = { name: string; destination: string; image: string; focus?: string };
type PathItem = TextItem & { href: string };

const practicalIcons = [GraduationCap, Languages, Building2];
const journeyIcons = [SearchCheck, Compass, FileCheck2, Languages, ShieldCheck, Home, Plane, GraduationCap];
const nextStepIcons = [Compass, GraduationCap, BookOpenCheck, Languages, MessageCircle, FileCheck2];

const examBrands = [
  { id: "TestDaF", label: "TestDaF", website: "https://www.testdaf.de/", logo: testDafLogo.url },
  { id: "telc", label: "telc Deutsch C1 Hochschule", website: "https://www.telc.net/sprachpruefungen/zertifikatspruefung/deutsch/telc-deutsch-c1-hochschule/", logo: telcLogo.url, logoOnDark: true },
  { id: "Goethe", label: "Goethe-Zertifikat", website: "https://www.goethe.de/en/spr/prf.html", logo: goetheLogo.url },
  { id: "DSH", label: "DSH-2", website: "https://www.hrk.de/themen/internationales/internationale-studierende-und-forschende/hochschulzugang-fuer-internationale-studierende/sprachnachweis-deutsch", logo: dshAuthorityLogo.url },
  { id: "TestAS", label: "TestAS", website: "https://www.testas.de/en/", logo: testAsLogo.url },
];

const StudentStory = ({ student, index, t }: { student: GalleryStudent; index: number; t: (key: string, options?: Record<string, unknown>) => string }) => (
  <figure className={`group relative shrink-0 snap-center overflow-hidden bg-muted ${index === 0 ? "w-[78vw] sm:col-span-5 lg:col-span-4" : "w-[68vw] sm:col-span-3 lg:col-span-2"} max-w-[360px] sm:w-auto sm:max-w-none ${index % 3 === 1 ? "sm:translate-y-8" : ""}`}>
    <div className={index === 0 ? "aspect-[4/5] sm:aspect-[4/3]" : "aspect-[3/4]"}>
      <img
        src={student.image}
        alt={student.name ? t("homepage.students.namedAlt", { name: student.name, destination: student.destination }) : t("homepage.students.alt", { destination: student.destination })}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none"
        style={{ objectPosition: student.focus || "50% 40%" }}
        onError={(event) => { event.currentTarget.hidden = true; }}
      />
    </div>
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary via-primary/75 to-transparent p-5 pt-16 text-primary-foreground">
      {student.name ? <p className="font-bold">{student.name}</p> : null}
      <p className="mt-1 flex items-center gap-1.5 text-sm text-primary-foreground/75"><MapPin className="size-3.5" />{student.destination}</p>
    </div>
  </figure>
);

const HomepageExperience = () => {
  const { t } = useTranslation("landing");
  const { isRtl } = useDirection();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const practical = t("homepage.explained.items", { returnObjects: true }) as TextItem[];
  const nextSteps = t("homepage.nextStep.items", { returnObjects: true }) as TextItem[];
  const services = t("homepage.services.items", { returnObjects: true }) as TextItem[];
  const students = t("studentGallery.students", { returnObjects: true }) as GalleryStudent[];
  const included = t("homepage.scope.included", { returnObjects: true }) as string[];
  const decisions = t("homepage.scope.decisions", { returnObjects: true }) as string[];
  const faqs = t("homepage.faq.items", { returnObjects: true }) as TextItem[];
  const [openExam, setOpenExam] = useState<string | null>(null);

  const nextStepRoutes: PathItem[] = [
    { ...nextSteps[0], href: "/educational-destinations" },
    { ...nextSteps[1], href: "/educational-programs" },
    { ...nextSteps[2], href: "/resources/bagrut-calculator" },
    { ...nextSteps[3], href: "/educational-destinations" },
    { ...nextSteps[4], href: "/ai-advisor" },
    { ...nextSteps[5], href: "/apply" },
  ].filter((item) => item.title);

  return (
    <div className="homepage-experience bg-background">
      <section className="darb-home-hero relative overflow-hidden bg-editorial-paper">
        <img src={germanyHero} alt={t("homepage.hero.imageAlt")} fetchPriority="high" decoding="async" width={1920} height={1080} className="absolute inset-0 h-full w-full object-cover object-center" />
        <BrandArch className="sm:hidden" />
        <div className="darb-home-hero-content container relative z-10 flex min-h-full items-center justify-center px-4">
          <div className="darb-home-hero-panel max-w-3xl border border-primary-foreground/15 bg-hero-panel/75 text-primary-foreground shadow-surface-lg backdrop-blur-sm">
            <div className="darb-home-hero-intro">
              <p className="darb-home-hero-eyebrow font-bold uppercase text-primary-foreground/65">{t("homepage.hero.eyebrow")}</p>
              <span aria-hidden="true" className="darb-home-hero-rule" />
            </div>
            <h1 className="darb-home-hero-title text-balance font-editorial font-semibold leading-[1.04]">{t("homepage.hero.campaign")}</h1>
            <p className="darb-home-hero-destination text-balance font-bold leading-tight">{t("homepage.hero.title")}</p>
            <p className="darb-home-hero-subtitle font-semibold leading-7 text-primary-foreground/85">{t("homepage.hero.subtitle")}</p>
            <div className="darb-home-hero-actions flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="text-base shadow-surface-lg"><Link to="/apply">{t("homepage.actions.apply")}<Arrow /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-primary-foreground/5 text-primary-foreground text-base hover:bg-primary-foreground hover:text-primary"><a href={whatsappBusinessUrl("مرحبا، بدي أعرف أكثر عن الدراسة بألمانيا مع درب.")} target="_blank" rel="noopener noreferrer"><MessageCircle />{t("homepage.actions.whatsapp")}</a></Button>
            </div>
            <p className="darb-home-hero-reassurance flex items-center gap-2 text-sm font-medium text-primary-foreground/75"><CircleCheck className="size-4 shrink-0 text-brand" />{t("homepage.hero.reassurance")}</p>
          </div>
        </div>
        <span aria-hidden="true" className="darb-spectrum darb-spectrum-lg absolute inset-x-0 bottom-0 z-20 rounded-none" />
      </section>

      <section aria-labelledby="homepage-explained-title" className="border-b border-border bg-background py-14 sm:py-18">
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("homepage.explained.eyebrow")}</p>
              <h2 id="homepage-explained-title" className="mt-3 text-balance text-3xl font-bold leading-tight text-primary sm:text-5xl">{t("homepage.explained.title")}</h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:justify-self-end">{t("homepage.explained.body")}</p>
          </div>
          <div className="mt-9 grid border-y border-border md:grid-cols-3">
            {practical.map((item, index) => {
              const Icon = practicalIcons[index] ?? CircleCheck;
              return <article key={item.title} className="group border-b border-border px-1 py-7 last:border-b-0 md:border-b-0 md:border-e md:px-7 md:first:ps-0 md:last:border-e-0 md:last:pe-0">
                <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-editorial-paper text-brand-strong"><Icon className="size-5" /></span><div><h3 className="text-lg font-bold text-primary">{item.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p></div></div>
              </article>;
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-next-step-title" className="bg-editorial-paper py-14 sm:py-20">
        <div className="container">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("homepage.nextStep.eyebrow")}</p>
            <h2 id="homepage-next-step-title" className="mt-3 text-balance text-3xl font-bold text-primary sm:text-5xl">{t("homepage.nextStep.title")}</h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">{t("homepage.nextStep.body")}</p>
          </div>
          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {nextStepRoutes.map((item, index) => {
              const Icon = nextStepIcons[index] ?? Compass;
              return <Link key={item.title} to={item.href} className="group grid min-h-36 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 bg-background p-5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Icon className="size-4.5" /></span>
                <span className="min-w-0"><span className="block font-bold text-primary">{item.title}</span><span className="mt-2 block text-sm leading-6 text-muted-foreground">{item.description}</span></span><Arrow className="mt-1 size-4 text-brand-strong transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </Link>;
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-services-title" className="bg-background py-14 sm:py-20">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[0.68fr_1.32fr]">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("homepage.services.eyebrow")}</p>
              <h2 id="homepage-services-title" className="mt-3 text-balance text-3xl font-bold leading-tight text-primary sm:text-5xl">{t("homepage.services.title")}</h2>
              <p className="mt-4 max-w-lg leading-7 text-muted-foreground">{t("homepage.services.body")}</p>
            </div>
            <div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0">
                {services.map((service, index) => {
                  const Icon = journeyIcons[index] ?? Check;
                  return <div key={service.title} className="contents">
                    <div className="relative flex justify-center"><span className="relative z-10 grid size-11 place-items-center rounded-full bg-primary text-primary-foreground"><Icon className="size-4.5" /></span>{index < services.length - 1 ? <span className="absolute inset-y-10 w-px bg-border" /> : null}</div>
                    <article className="min-w-0 border-b border-border pb-7 pt-1 last:border-b-0"><p className="text-xs font-bold text-brand-strong">{String(index + 1).padStart(2, "0")}</p><h3 className="mt-1 text-xl font-bold text-primary">{service.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{service.description}</p></article>
                  </div>;
                })}
              </div>
              <div className="mt-8 rounded-lg bg-primary p-6 text-primary-foreground sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{t("homepage.path.arrivalEyebrow")}</p><h3 className="mt-2 text-2xl font-bold">{t("homepage.path.arrivalTitle")}</h3><p className="mt-3 max-w-2xl text-sm leading-7 text-primary-foreground/75">{t("homepage.path.arrivalBody")}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-students-title" className="relative overflow-hidden bg-primary py-14 text-primary-foreground sm:py-20">
        <BrandArch variant="frame" className="opacity-40" />
        <div className="container relative z-10">
          <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{t("homepage.students.eyebrow")}</p><h2 id="homepage-students-title" className="mt-3 text-balance text-3xl font-bold leading-tight sm:text-5xl">{t("homepage.students.title")}</h2></div>
            <p className="max-w-2xl leading-7 text-primary-foreground/70 lg:justify-self-end">{t("homepage.students.body")}</p>
          </div>
          <div className="-mx-4 mt-9 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-8 sm:items-start sm:overflow-visible sm:px-0 lg:grid-cols-12">
            {students.slice(0, 5).map((student, index) => <StudentStory key={`${student.image}-${index}`} student={student} index={index} t={t} />)}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-ecosystem-title" className="bg-editorial-paper py-14 sm:py-20">
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-[0.65fr_1.35fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("homepage.network.eyebrow")}</p>
              <h2 id="homepage-ecosystem-title" className="mt-3 text-balance text-3xl font-bold leading-tight text-primary sm:text-5xl">{t("homepage.network.title")}</h2>
              <p className="mt-4 max-w-lg leading-7 text-muted-foreground">{t("homepage.network.body")}</p>
              <div className="mt-7 grid grid-cols-2 gap-2">
                {["language", "admission", "assessment", "recognition"].map((key) => <div key={key} className="border-s-2 border-brand bg-background px-4 py-3 text-sm font-bold text-primary">{t(`homepage.network.pillars.${key}`)}</div>)}
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-bold text-primary">{t("homepage.network.tu9Label")}</h3><a href="https://www.tu9.de/en/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs font-bold text-brand-strong">{t("homepage.network.viewTu9")}</a></div>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
                  {tu9Universities.map((uni) => <IdentityStage key={uni.name} name={uni.name} imageUrl={uni.logoUrl} href={uni.url} meta={uni.city} />)}
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-bold text-primary">{t("homepage.network.examsLabel")}</h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {examBrands.map((exam) => <ExamFlipCard key={exam.id} name={exam.label} logoSrc={exam.logo} logoOnDark={exam.logoOnDark} href={exam.website} description={t(`homepage.languagePrep.exams.${exam.id}.verifiedDescription`)} caveat={t(`homepage.languagePrep.exams.${exam.id}.caveat`)} officialLabel={t("homepage.languagePrep.officialPortal")} flipLabel={t("homepage.languagePrep.flipCue")} backLabel={t("homepage.languagePrep.flipBack")} open={openExam === exam.id} onOpen={() => setOpenExam(exam.id)} onClose={() => setOpenExam(null)} />)}
                </div>
              </div>
              <CefrGuide />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-destinations-title" className="bg-background py-14 sm:py-20">
        <div className="container">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("homepage.destinations.eyebrow")}</p><h2 id="homepage-destinations-title" className="mt-3 text-3xl font-bold text-primary sm:text-5xl">{t("homepage.destinations.title")}</h2></div><Link to="/educational-destinations" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-strong">{t("homepage.destinations.cta")}<Arrow className="size-4" /></Link></div>
          <div className="mt-8 grid auto-rows-[190px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {languageYearCities.slice(0, 5).map((city, index) => <a key={city.id} href={city.cityUrl} target="_blank" rel="noopener noreferrer" className={`group relative overflow-hidden rounded-lg bg-muted ${index === 0 ? "sm:col-span-2 sm:row-span-2" : ""} ${index === 4 ? "sm:col-span-2" : ""}`}><img src={city.imageUrl} alt={city.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none" onError={(event) => { if (event.currentTarget.src !== germanyHero) event.currentTarget.src = germanyHero; }} /><div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/10 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-5 text-primary-foreground"><p className="text-xs text-primary-foreground/65">{city.region}</p><h3 className="mt-1 text-2xl font-bold">{city.name}</h3></div></a>)}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-trust-title" className="bg-editorial-paper py-14 sm:py-20">
        <div className="container">
          <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("homepage.trust.eyebrow")}</p><h2 id="homepage-trust-title" className="mt-3 text-balance text-3xl font-bold text-primary sm:text-5xl">{t("homepage.trust.title")}</h2></div>
          <div className="mt-8 grid gap-3 lg:grid-cols-2"><article className="rounded-lg bg-primary p-6 text-primary-foreground sm:p-8"><div className="flex items-center gap-3"><CircleCheck className="size-6 text-brand" /><h3 className="text-xl font-bold">{t("homepage.scope.includedTitle")}</h3></div><ul className="mt-6 grid gap-3 sm:grid-cols-2">{included.map((item) => <li key={item} className="flex items-start gap-2 text-sm text-primary-foreground/75"><Check className="mt-0.5 size-4 shrink-0 text-brand" />{item}</li>)}</ul></article><article className="rounded-lg border border-border bg-background p-6 sm:p-8"><div className="flex items-center gap-3"><Building2 className="size-6 text-brand-strong" /><h3 className="text-xl font-bold text-primary">{t("homepage.scope.decisionsTitle")}</h3></div><ul className="mt-6 grid gap-3 sm:grid-cols-2">{decisions.map((item) => <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />{item}</li>)}</ul></article></div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">{["assess", "breakdown", "payment"].map((key, index) => <article key={key} className="border-t-2 border-brand bg-background p-6"><p className="text-xs font-bold text-brand-strong">0{index + 1}</p><h3 className="mt-4 text-lg font-bold text-primary">{t(`homepage.pricing.${key}Title`)}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{t(`homepage.pricing.${key}Body`)}</p></article>)}</div>
        </div>
      </section>

      <section aria-labelledby="homepage-faq-title" className="bg-background py-14 sm:py-20"><div className="container grid gap-9 lg:grid-cols-[0.7fr_1.3fr]"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("homepage.faq.eyebrow")}</p><h2 id="homepage-faq-title" className="mt-3 text-balance text-3xl font-bold text-primary sm:text-5xl">{t("homepage.faq.title")}</h2><Button asChild variant="outline" className="mt-6"><Link to="/faq">{t("homepage.faq.all")}<Arrow /></Link></Button></div><Accordion type="single" collapsible className="border-t border-border">{faqs.map((item, index) => <AccordionItem key={item.title} value={`faq-${index}`}><AccordionTrigger className="text-start text-base font-bold text-primary hover:no-underline sm:text-lg">{item.title}</AccordionTrigger><AccordionContent className="pe-8 text-sm leading-7 text-muted-foreground">{item.description}</AccordionContent></AccordionItem>)}</Accordion></div></section>

      <section className="relative overflow-hidden bg-primary text-primary-foreground"><BrandArch className="opacity-25" /><div className="container relative z-10 grid gap-7 py-14 sm:py-18 lg:grid-cols-[1fr_auto] lg:items-end"><div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{t("homepage.final.eyebrow")}</p><h2 className="mt-3 text-balance font-editorial text-4xl leading-tight sm:text-6xl">{t("homepage.final.title")}</h2><p className="mt-4 max-w-2xl leading-7 text-primary-foreground/70">{t("homepage.final.body")}</p></div><div className="flex flex-col gap-3 sm:flex-row lg:flex-col"><Button asChild size="lg"><Link to="/apply">{t("homepage.actions.startAssessment")}<Arrow /></Link></Button><Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary"><a href={whatsappBusinessUrl("مرحبا، بدي أعرف شو خطوتي الجاية للدراسة بألمانيا.")} target="_blank" rel="noopener noreferrer"><MessageCircle />{t("homepage.actions.whatsapp")}</a></Button></div></div><span aria-hidden="true" className="darb-spectrum darb-spectrum-lg block rounded-none" /></section>
    </div>
  );
};

export default HomepageExperience;
