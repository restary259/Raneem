
import { ArrowUpRight, Mail } from "lucide-react";
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

const WhoWeArePage = () => {
  const { t } = useTranslation(["about", "common"]);
  const { dir } = useDirection();
  const chapters = t("whoWeAre.story.chapters", { returnObjects: true }) as StoryChapter[];

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

        <section className="border-b border-border bg-background py-14 sm:py-20" aria-labelledby="about-founder-title">
          <div className="container grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("whoWeAre.founder.eyebrow")}</p>
              <p aria-hidden="true" className="mt-6 font-editorial text-7xl leading-none text-primary sm:text-8xl">22</p>
              <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">{t("whoWeAre.founder.fact")}</p>
            </div>
            <div className="border-s border-border ps-6 sm:ps-10">
              <h2 id="about-founder-title" className="max-w-3xl text-balance font-editorial text-4xl leading-tight text-primary sm:text-6xl">{t("whoWeAre.founder.title")}</h2>
              <div className="mt-7 max-w-3xl space-y-5 text-base leading-8 text-muted-foreground sm:text-lg">
                <p>{t("whoWeAre.founder.bodyOne")}</p>
                <p>{t("whoWeAre.founder.bodyTwo")}</p>
              </div>
              <p className="mt-8 text-sm font-bold uppercase tracking-[0.14em] text-primary">{t("whoWeAre.founder.signature")}</p>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-editorial-paper py-14 sm:py-20" aria-labelledby="about-story-title">
          <div className="container">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("whoWeAre.story.eyebrow")}</p>
              <h2 id="about-story-title" className="mt-3 text-balance font-editorial text-4xl leading-tight text-primary sm:text-6xl">{t("whoWeAre.story.title")}</h2>
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

        <section className="bg-background py-14 sm:py-20" aria-labelledby="about-direction-title">
          <div className="container">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("whoWeAre.direction.eyebrow")}</p>
            <h2 id="about-direction-title" className="mt-3 max-w-3xl text-balance text-3xl font-bold text-primary sm:text-5xl">{t("whoWeAre.direction.title")}</h2>
            <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-2">
              <article className="bg-primary p-7 text-primary-foreground sm:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{t("whoWeAre.direction.missionLabel")}</p>
                <h3 className="mt-5 font-editorial text-4xl leading-tight sm:text-5xl">{t("whoWeAre.direction.missionTitle")}</h3>
                <p className="mt-5 max-w-xl leading-7 text-primary-foreground/75">{t("whoWeAre.direction.missionBody")}</p>
              </article>
              <article className="bg-background p-7 sm:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{t("whoWeAre.direction.visionLabel")}</p>
                <h3 className="mt-5 font-editorial text-4xl leading-tight text-primary sm:text-5xl">{t("whoWeAre.direction.visionTitle")}</h3>
                <p className="mt-5 max-w-xl leading-7 text-muted-foreground">{t("whoWeAre.direction.visionBody")}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-primary py-14 text-primary-foreground sm:py-20" aria-labelledby="about-team-title">
          <div className="container relative z-10 grid gap-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{t("whoWeAre.team.eyebrow")}</p>
              <h2 id="about-team-title" className="mt-3 text-balance font-editorial text-4xl leading-tight sm:text-6xl">{t("whoWeAre.team.title")}</h2>
            </div>
            <div className="max-w-2xl lg:justify-self-end">
              <p className="text-base leading-8 text-primary-foreground/75">{t("whoWeAre.team.body")}</p>
              <p className="mt-5 border-s border-brand ps-5 text-base leading-8 text-primary-foreground/90">{t("whoWeAre.team.personal")}</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-6 inline-flex min-h-11 items-center gap-2 font-bold text-primary-foreground underline decoration-brand/70 underline-offset-4"><Mail className="size-4" />{t("whoWeAre.team.contact")}<ArrowUpRight className="size-4" /></a>
            </div>
          </div>
          <span aria-hidden="true" className="darb-spectrum darb-spectrum-lg absolute inset-x-0 bottom-0 rounded-none" />
        </section>

        <section className="border-b border-border bg-editorial-paper py-14 sm:py-20" aria-labelledby="about-closing-title">
          <div className="container grid gap-6 lg:grid-cols-[0.55fr_1.45fr] lg:gap-16">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("whoWeAre.closing.eyebrow")}</p>
            <div>
              <h2 id="about-closing-title" className="max-w-4xl text-balance font-editorial text-4xl leading-tight text-primary sm:text-6xl">{t("whoWeAre.closing.title")}</h2>
              <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">{t("whoWeAre.closing.body")}</p>
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
