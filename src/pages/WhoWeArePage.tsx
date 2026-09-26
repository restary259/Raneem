
import { ArrowUpRight, Check, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import DarbContactCta from "@/components/common/DarbContactCta";
import DarbPageHero from "@/components/common/DarbPageHero";
import SEOHead from "@/components/common/SEOHead";
import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";
import { DARB_PUBLIC_HERO_IMAGES } from "@/config/publicHeroImages";
import { SUPPORT_EMAIL } from "@/lib/contactConfig";
import { useDirection } from "@/hooks/useDirection";

type StoryChapter = { marker: string; title: string; body: string };
type Principle = { title: string; body: string; practice: string };

const WhoWeArePage = () => {
  const { t } = useTranslation(["about", "common"]);
  const { dir } = useDirection();
  const chapters = t("whoWeAre.story.chapters", { returnObjects: true }) as StoryChapter[];
  const principles = t("whoWeAre.principles.items", { returnObjects: true }) as Principle[];

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground" dir={dir}>
      <SEOHead title={t("seo.whoWeAreTitle", { ns: "common" })} description={t("seo.whoWeAreDesc", { ns: "common" })} />
      <Header />
      <main className="flex-grow">
        <DarbPageHero
          imageUrl={DARB_PUBLIC_HERO_IMAGES.office}
          imageAlt={t("whoWeAre.imageAlt")}
          title={t("whoWeAre.heroTitle")}
          subtitle={t("whoWeAre.heroSubtitle")}
        />

        <section className="border-b border-border bg-background py-14 sm:py-20" aria-labelledby="about-story-title">
          <div className="container">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("whoWeAre.story.eyebrow")}</p>
              <h2 id="about-story-title" className="mt-3 text-balance font-editorial text-4xl leading-tight text-primary sm:text-4xl">{t("whoWeAre.story.title")}</h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted-foreground">{t("whoWeAre.story.body")}</p>
            </div>

            <div className="relative mx-auto mt-14 max-w-5xl">
              <span aria-hidden="true" className="absolute inset-y-0 start-5 w-px bg-border md:start-1/2 md:-translate-x-1/2 rtl:md:translate-x-1/2" />
              <div className="space-y-12 md:space-y-20">
                {Array.isArray(chapters) && chapters.map((chapter, index) => (
                  <article key={chapter.title} className="relative grid gap-5 ps-14 md:grid-cols-2 md:gap-20 md:ps-0">
                    <span aria-hidden="true" className="absolute start-3.5 top-1.5 z-10 size-3 rounded-full border-4 border-background bg-primary md:start-1/2 md:-translate-x-1/2 rtl:md:translate-x-1/2" />
                    <div className={index % 2 === 0 ? "md:text-end" : "md:col-start-2"}>
                      <p className="font-editorial text-3xl text-brand-strong">{chapter.marker}</p>
                      <h3 className="mt-2 text-2xl font-bold text-primary">{chapter.title}</h3>
                      <p className="mt-3 leading-7 text-muted-foreground">{chapter.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-editorial-paper py-14 sm:py-20" aria-labelledby="about-direction-title">
          <div className="container">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("whoWeAre.direction.eyebrow")}</p>
            <h2 id="about-direction-title" className="mt-3 max-w-3xl text-balance text-3xl font-bold text-primary sm:text-4xl">{t("whoWeAre.direction.title")}</h2>
            <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-2">
              <article className="bg-info-surface p-7 sm:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{t("whoWeAre.direction.missionLabel")}</p>
                <h3 className="mt-5 font-editorial text-3xl leading-tight text-primary sm:text-4xl">{t("whoWeAre.direction.missionTitle")}</h3>
                <p className="mt-5 max-w-xl leading-7 text-muted-foreground">{t("whoWeAre.direction.missionBody")}</p>
              </article>
              <article className="bg-background p-7 sm:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{t("whoWeAre.direction.visionLabel")}</p>
                <h3 className="mt-5 font-editorial text-4xl leading-tight text-primary sm:text-5xl">{t("whoWeAre.direction.visionTitle")}</h3>
                <p className="mt-5 max-w-xl leading-7 text-muted-foreground">{t("whoWeAre.direction.visionBody")}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="bg-background py-14 sm:py-20" aria-labelledby="about-principles-title">
          <div className="container grid gap-10 lg:grid-cols-[0.62fr_1.38fr]">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("whoWeAre.principles.eyebrow")}</p>
              <h2 id="about-principles-title" className="mt-3 text-balance text-3xl font-bold text-primary sm:text-4xl">{t("whoWeAre.principles.title")}</h2>
              <p className="mt-4 max-w-lg leading-7 text-muted-foreground">{t("whoWeAre.principles.body")}</p>
            </div>
            <div className="border-t border-border">
              {Array.isArray(principles) && principles.map((principle, index) => (
                <article key={principle.title} className="grid gap-4 border-b border-border py-7 sm:grid-cols-[72px_minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-7 sm:py-9">
                  <p className="font-editorial text-3xl text-brand-strong">{String(index + 1).padStart(2, "0")}</p>
                  <div><h3 className="text-xl font-bold text-primary">{principle.title}</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">{principle.body}</p></div>
                  <div className="flex items-start gap-3 bg-editorial-paper p-5 text-sm leading-7 text-foreground"><Check className="mt-1 size-4 shrink-0 text-brand-strong" /><span>{principle.practice}</span></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-border bg-canvas py-16 text-primary sm:py-24" aria-labelledby="about-team-title">
          <div className="container relative z-10 grid gap-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{t("whoWeAre.team.eyebrow")}</p>
              <h2 id="about-team-title" className="mt-3 text-balance font-editorial text-4xl leading-tight sm:text-4xl">{t("whoWeAre.team.title")}</h2>
            </div>
            <div className="max-w-2xl lg:justify-self-end">
              <p className="text-base leading-8 text-muted-foreground">{t("whoWeAre.team.body")}</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-6 inline-flex min-h-11 items-center gap-2 font-bold text-primary underline decoration-highlight decoration-2 underline-offset-4"><Mail className="size-4" />{t("whoWeAre.team.contact")}<ArrowUpRight className="size-4" /></a>
            </div>
          </div>
        </section>

        <DarbContactCta />
      </main>
      <Footer />
    </div>
  );
};
export default WhoWeArePage;
