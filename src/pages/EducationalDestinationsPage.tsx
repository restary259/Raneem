import React from "react";
import { ArrowUpRight, Award, Building2, CalendarDays, Check, ExternalLink, Languages, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import SEOHead from "@/components/common/SEOHead";
import DarbPageHero from "@/components/common/DarbPageHero";
import { DARB_PUBLIC_HERO_IMAGES } from "@/config/publicHeroImages";
import { Link } from "@/lib/router-compat";
import { useDirection } from "@/hooks/useDirection";
import { languageYearCities, languageYearSchools, tu9Universities } from "@/data/educationalDestinations";

const schoolCityMap = {
  heidelberg: "Heidelberg",
  dusseldorf: "Düsseldorf",
  dortmund: "Dortmund",
  berlin: "Berlin",
} as const;

const EducationalDestinationsPage = () => {
  const { t } = useTranslation("common");
  const { dir } = useDirection();

  return (
    <div className="min-h-screen bg-background text-foreground" dir={dir}>
      <SEOHead title={t("seo.edDestTitle")} description={t("seo.edDestDesc")} />
      <Header />

      <main>
        <DarbPageHero
          eyebrow={t("destinations.heroEyebrow")}
          imageUrl={DARB_PUBLIC_HERO_IMAGES.destinations}
          imageAlt={t("educational.edImageAlt", "Bright German university environment")}
          title={t("destinations.heroTitle")}
          subtitle={t("destinations.heroSubtitle")}
        />

        <section className="border-b border-border bg-background py-14 sm:py-18">
          <div className="container">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div className="max-w-xl">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">
                  {t("destinations.introEyebrow")}
                </p>
                <h2 className="mt-3 text-3xl font-bold leading-tight text-primary sm:text-4xl">
                  {t("destinations.introTitle")}
                </h2>
                <p className="mt-4 text-base leading-8 text-muted-foreground sm:text-lg">
                  {t("destinations.introBody")}
                </p>
              </div>

              <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
                {[
                  ["01", "step1Title", "step1Body"],
                  ["02", "step2Title", "step2Body"],
                  ["03", "step3Title", "step3Body"],
                  ["04", "step4Title", "step4Body"],
                ].map(([number, titleKey, bodyKey]) => (
                  <article key={number} className="bg-background p-6 sm:p-7">
                    <span className="text-xs font-bold text-brand-strong">{number}</span>
                    <h3 className="mt-4 text-lg font-bold text-primary">{t(`destinations.${titleKey}`)}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{t(`destinations.${bodyKey}`)}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-editorial-paper py-16 sm:py-20">
          <div className="container">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">
                {t("destinations.citiesEyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight text-primary sm:text-4xl">
                {t("destinations.citiesTitle")}
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                {t("destinations.citiesBody")}
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              {languageYearCities.map((city) => (
                <article key={city.id} className="group overflow-hidden border border-border bg-background shadow-surface transition-shadow hover:shadow-surface-lg">
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={city.imageUrl}
                      alt={city.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-primary/35" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-primary-foreground">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/75">
                            {t(`destinations.cities.${city.id}.region`)}
                          </p>
                          <h3 className="mt-1 text-3xl font-bold">{city.name}</h3>
                        </div>
                        <MapPin className="h-6 w-6 shrink-0" />
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <p className="text-sm leading-7 text-muted-foreground">
                      {t(city.descriptionKey)}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {city.highlights.map((highlightKey) => (
                        <span key={highlightKey} className="inline-flex items-center gap-1.5 border border-border bg-editorial-paper px-3 py-1.5 text-xs font-medium text-primary">
                          <Check className="h-3.5 w-3.5 text-trust" />
                          {t(highlightKey)}
                        </span>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-4 border-t border-border pt-5 text-sm">
                      <a href={city.cityUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-brand-strong">
                        {t("destinations.exploreCity")}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <span className="text-muted-foreground">•</span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {t("destinations.cityLife")}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {city.activityLinks.map((link) => (
                        <a
                          key={link.url}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-brand-strong hover:text-brand-strong"
                        >
                          {t(link.labelKey)}
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background py-16 sm:py-20">
          <div className="container">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">
                {t("destinations.schoolsEyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight text-primary sm:text-4xl">
                {t("destinations.schoolsTitle")}
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                {t("destinations.schoolsBody")}
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              {languageYearSchools.map((school) => (
                <article key={school.name} className="border border-border bg-background p-6 shadow-surface sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {school.logoUrl ? (
                        <div className="mb-5 flex h-14 w-40 items-center border border-border bg-white px-3">
                          <img src={school.logoUrl} alt={school.name} className="max-h-10 max-w-full object-contain" loading="lazy" />
                        </div>
                      ) : (
                        <div className="mb-5 flex h-14 w-40 items-center border border-border bg-editorial-paper px-3 text-sm font-bold text-primary">
                          {school.name}
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-strong">
                        <Building2 className="h-3.5 w-3.5" />
                        {schoolCityMap[school.city]}
                      </div>
                      <h3 className="mt-2 text-xl font-bold text-primary sm:text-2xl">{school.name}</h3>
                    </div>
                    <span className="shrink-0 border border-border bg-editorial-paper px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {t("destinations.institutionCredential")}
                    </span>
                  </div>

                  <p className="mt-5 text-sm leading-7 text-muted-foreground">
                    {t(school.descriptionKey)}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {school.credentials.map((credential) => (
                      <span key={credential} className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 text-xs font-semibold text-primary">
                        {credential.includes("Award") || credential.includes("Excellence") ? (
                          <Award className="h-3.5 w-3.5 text-brand-strong" />
                        ) : credential.includes("Test") || credential.includes("telc") || credential.includes("TOEFL") || credential.includes("IELTS") || credential.includes("OnSET") ? (
                          <Languages className="h-3.5 w-3.5 text-brand-strong" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-trust" />
                        )}
                        {credential}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 border-t border-border pt-4">
                    <p className="text-xs leading-6 text-muted-foreground">{t(school.credentialsNoteKey ?? "destinations.disclosureBody")}</p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-4 text-sm">
                    <a href={school.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-brand-strong">
                      {t("destinations.officialSchool")}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {school.activityUrl ? (
                      <a href={school.activityUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground hover:text-brand-strong">
                        {t("destinations.schoolLife")}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            <p className="mt-6 text-xs text-muted-foreground">{t("destinations.verified")}</p>
          </div>
        </section>

        <section className="border-y border-border bg-editorial-paper py-16 sm:py-20">
          <div className="container">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">
                {t("destinations.tu9Eyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight text-primary sm:text-4xl">
                {t("destinations.tu9Title")}
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                {t("destinations.tu9Body")}
              </p>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tu9Universities.map((uni, index) => (
                <a
                  key={uni.name}
                  href={uni.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-h-28 flex-col justify-between border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-surface"
                >
                  <span className="text-xs font-bold text-brand-strong">{String(index + 1).padStart(2, "0")}</span>
                  <div className="mt-4">
                    <h3 className="font-bold text-primary group-hover:text-brand-strong">{uni.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {uni.city}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary py-14 text-primary-foreground sm:py-18">
          <div className="container flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold sm:text-3xl">{t("destinations.endTitle")}</h2>
              <p className="mt-3 text-sm leading-7 text-primary-foreground/70 sm:text-base">{t("destinations.endBody")}</p>
            </div>
            <Link
              to="/apply"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-brand px-6 text-sm font-bold text-brand-foreground transition-colors hover:bg-brand/90"
            >
              {t("destinations.endButton")}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="bg-background py-7">
          <div className="container">
            <div className="flex items-start gap-3 border border-border bg-editorial-paper p-4 sm:p-5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-trust" />
              <p className="text-xs leading-6 text-muted-foreground">
                <strong className="text-primary">{t("destinations.disclosureTitle")}:</strong>{" "}
                {t("destinations.disclosureBody")}
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default EducationalDestinationsPage;
