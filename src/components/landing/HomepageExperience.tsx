import { Link } from "react-router-dom";
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
import { WHATSAPP_PHONE_URL } from "@/lib/contactConfig";
import { useDirection } from "@/hooks/useDirection";

type TextItem = { title: string; description: string };
type GalleryStudent = { name: string; destination: string; image: string; focus?: string };

const serviceIcons = [SearchCheck, FileCheck2, ShieldCheck, Home, HeartHandshake];
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
      <section className="relative flex min-h-[660px] items-end overflow-hidden bg-primary pb-12 pt-28 text-primary-foreground sm:min-h-[720px] md:h-[calc(100svh-4rem)] md:min-h-[640px] md:max-h-[800px] md:items-center md:py-20">
        <img
          src="/lovable-uploads/hero-poster.webp"
          alt={t("homepage.hero.imageAlt")}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-primary/80" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-primary via-primary/75 to-transparent" />

        <div className="container relative z-10 mx-auto">
          <div className="max-w-4xl">
            <p className="mb-5 inline-flex items-center gap-2 border-s-2 border-brand ps-3 text-sm font-semibold text-primary-foreground/90">
              <span className="h-2 w-2 rounded-full bg-trust" aria-hidden="true" />
              {t("homepage.hero.eyebrow")}
            </p>
            <h1 className="max-w-4xl text-4xl font-bold leading-[1.12] text-primary-foreground sm:text-6xl lg:text-7xl">
              {t("homepage.hero.title")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-primary-foreground/85 sm:text-xl">
              {t("homepage.hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent" className="h-14 rounded-md px-7 text-base shadow-surface-lg">
                <Link to="/apply">
                  {t("homepage.actions.apply")}
                  <Arrow className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 rounded-md border-primary-foreground/35 bg-primary/30 px-7 text-base text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                <a href={WHATSAPP_PHONE_URL} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5" />
                  {t("homepage.actions.whatsapp")}
                </a>
              </Button>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-primary-foreground/70">
              <CircleCheck className="h-4 w-4 text-trust" />
              {t("homepage.hero.reassurance")}
            </p>
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
        <div className="container grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
          <div>
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
          <div className="relative overflow-hidden rounded-md">
            <img
              src="/lovable-uploads/d34cf9ba-952a-4971-b654-9fabf29dd95d.webp"
              alt={t("homepage.parents.imageAlt")}
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/90 to-transparent p-6 pt-24 text-primary-foreground">
              <ShieldCheck className="h-7 w-7 text-brand" />
              <p className="mt-3 text-2xl font-bold">{t("homepage.parents.caption")}</p>
            </div>
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

      <section className="relative overflow-hidden bg-primary py-20 text-primary-foreground sm:py-28">
        <div className="absolute inset-y-0 end-0 w-1/3 border-s border-primary-foreground/10" aria-hidden="true" />
        <div className="container relative">
          <p className="text-xs font-bold uppercase text-brand">{t("homepage.final.eyebrow")}</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">{t("homepage.final.title")}</h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-primary-foreground/70">{t("homepage.final.body")}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="accent" className="h-14 rounded-md px-7 text-base">
              <Link to="/apply">{t("homepage.actions.apply")}<Arrow className="h-5 w-5" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-md border-primary-foreground/30 bg-transparent px-7 text-base text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              <a href={WHATSAPP_PHONE_URL} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-5 w-5" />{t("homepage.actions.whatsapp")}</a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomepageExperience;