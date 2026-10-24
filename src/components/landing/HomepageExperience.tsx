import { Link } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappBusinessUrl } from "@/lib/contactConfig";
import { useDirection } from "@/hooks/useDirection";
import RoadmapJourney from "./home/RoadmapJourney";
import JourneyCelebration from "./home/JourneyCelebration";
import RotatingHeadline from "./home/RotatingHeadline";

type GalleryStudent = { name: string; destination: string; image: string; focus?: string };

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
  const students = t("studentGallery.students", { returnObjects: true }) as GalleryStudent[];
  const rotating = t("homepage.hero.rotating", { returnObjects: true }) as string[];
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
              <RotatingHeadline words={rotating} />
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-primary-foreground/80 sm:text-lg sm:leading-8">
              {t("homepage.hero.body")}
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

      <div aria-hidden="true" className="darb-spectrum darb-spectrum-lg rounded-none" />

      <RoadmapJourney />

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

      <section aria-labelledby="homepage-final-title" className="relative isolate overflow-hidden bg-primary text-primary-foreground">
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
      <JourneyCelebration />
    </div>
  );
};

export default HomepageExperience;
