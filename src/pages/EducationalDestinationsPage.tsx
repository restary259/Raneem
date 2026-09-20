import { ArrowUpRight, Award, BadgeCheck, BookOpenCheck, Building2, CalendarDays, Check, ExternalLink, GraduationCap, Home, Languages, MapPin, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import SEOHead from "@/components/common/SEOHead";
import DarbPageHero from "@/components/common/DarbPageHero";
import DarbContactCta from "@/components/common/DarbContactCta";
import { DARB_PUBLIC_HERO_IMAGES } from "@/config/publicHeroImages";
import { Link } from "@/lib/router-compat";
import { useDirection } from "@/hooks/useDirection";
import { languageYearCities, languageYearSchools, tu9Universities } from "@/data/educationalDestinations";

const examLabelKey = (value: string) =>
  ({
    telc: "destinations.examLabels.telc",
    TestDaF: "destinations.examLabels.testDaF",
    TestAS: "destinations.examLabels.testAS",
    IELTS: "destinations.examLabels.ielts",
    TOEFL: "destinations.examLabels.toefl",
    TOEIC: "destinations.examLabels.toeic",
    "DSH preparation": "destinations.examLabels.dshPreparation",
    DSH: "destinations.examLabels.dsh",
    OnSET: "destinations.examLabels.onset",
  })[value] ?? value;

const EducationalDestinationsPage = () => {
  const { t } = useTranslation("common");
  const { dir } = useDirection();

  const journeyStages = [
    {
      number: "01",
      icon: MapPin,
      title: t("destinations.journey.stage1Title"),
      body: t("destinations.journey.stage1Body"),
    },
    {
      number: "02",
      icon: Languages,
      title: t("destinations.journey.stage2Title"),
      body: t("destinations.journey.stage2Body"),
    },
    {
      number: "03",
      icon: Languages,
      title: t("destinations.journey.stage3Title"),
      body: t("destinations.journey.stage3Body"),
    },
    {
      number: "04",
      icon: BookOpenCheck,
      title: t("destinations.journey.stage4Title"),
      body: t("destinations.journey.stage4Body"),
    },
    {
      number: "05",
      icon: BadgeCheck,
      title: t("destinations.journey.stage5Title"),
      body: t("destinations.journey.stage5Body"),
    },
    {
      number: "06",
      icon: GraduationCap,
      title: t("destinations.journey.stage6Title"),
      body: t("destinations.journey.stage6Body"),
    },
  ];

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

        <section className="bg-background py-14 sm:py-18">
          <div className="container">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">
                {t("destinations.selectionEyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight text-primary sm:text-4xl">
                {t("destinations.selectionTitle")}
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                {t("destinations.selectionBody")}
              </p>
            </div>

            <div className="mt-9 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["selection1", "selection1Body", GraduationCap],
                ["selection2", "selection2Body", BookOpenCheck],
                ["selection3", "selection3Body", Home],
                ["selection4", "selection4Body", MapPin],
              ].map(([titleKey, bodyKey, Icon]) => (
                <article key={titleKey as string} className="bg-background p-6 sm:p-7">
                  <Icon className="h-6 w-6 text-brand-strong" />
                  <h3 className="mt-5 text-base font-bold text-primary">{t(`destinations.${titleKey}`)}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{t(`destinations.${bodyKey}`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-editorial-paper py-14 sm:py-18">
          <div className="container">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">
                  {t("destinations.journey.eyebrow")}
                </p>
                <h2 className="mt-3 text-3xl font-bold leading-tight text-primary sm:text-4xl">
                  {t("destinations.journey.title")}
                </h2>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  {t("destinations.journey.body")}
                </p>
              </div>
              <p className="max-w-md text-xs leading-6 text-muted-foreground">
                {t("destinations.journey.note")}
              </p>
            </div>

            <div className="mt-9 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {journeyStages.map((stage) => {
                const Icon = stage.icon;
                return (
                  <article key={stage.number} className="relative border border-border bg-background p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs font-bold text-brand-strong">{stage.number}</span>
                      <Icon className="h-5 w-5 text-brand-strong" />
                    </div>
                    <h3 className="mt-5 text-base font-bold text-primary">{stage.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{stage.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-background py-14 sm:py-18">
          <div className="container">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">
                {t("destinations.compareEyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight text-primary sm:text-4xl">
                {t("destinations.compareTitle")}
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                {t("destinations.compareBody")}
              </p>
            </div>

            <div className="mt-9 overflow-x-auto border border-border">
              <table className="min-w-[760px] w-full border-collapse text-left text-sm rtl:text-right">
                <thead className="bg-editorial-paper">
                  <tr className="border-b border-border">
                    <th className="px-4 py-4 font-bold text-primary sm:px-5">{t("destinations.compareHeaders.city")}</th>
                    <th className="px-4 py-4 font-bold text-primary sm:px-5">{t("destinations.compareHeaders.region")}</th>
                    <th className="px-4 py-4 font-bold text-primary sm:px-5">{t("destinations.compareHeaders.institutions")}</th>
                    <th className="px-4 py-4 font-bold text-primary sm:px-5">{t("destinations.compareHeaders.cityContext")}</th>
                    <th className="px-4 py-4 font-bold text-primary sm:px-5">{t("destinations.compareHeaders.source")}</th>
                  </tr>
                </thead>
                <tbody>
                  {languageYearCities.map((city) => {
                    const institutionCount = languageYearSchools.filter((school) => school.city === city.id).length;
                    return (
                      <tr key={city.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-4 font-bold text-primary sm:px-5">{city.name}</td>
                        <td className="px-4 py-4 text-muted-foreground sm:px-5">{t(`destinations.cities.${city.id}.region`)}</td>
                        <td className="px-4 py-4 text-muted-foreground sm:px-5">
                          <span className="font-semibold text-primary">{institutionCount}</span> {t("destinations.compareHeaders.featuredLabel")}
                        </td>
                        <td className="max-w-xl px-4 py-4 leading-6 text-muted-foreground sm:px-5">
                          {t(city.descriptionKey)}
                        </td>
                        <td className="px-4 py-4 sm:px-5">
                          <a
                            href={city.cityUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-brand-strong"
                          >
                            {t("destinations.exploreCity")}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                  <div className="relative h-56 overflow-hidden sm:h-64">
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
                    <p className="text-sm leading-7 text-muted-foreground">{t(city.descriptionKey)}</p>

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
                    {city.photoCredit ? (
                      <div className="absolute bottom-2 left-3 z-10 text-[9px] font-medium text-white/80">
                        <a href={city.photoCredit.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                          {city.photoCredit.label}
                        </a>
                      </div>
                    ) : null}
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

            <div className="mt-10 space-y-12">
              {languageYearCities.map((city) => {
                const citySchools = languageYearSchools.filter((school) => school.city === city.id);
                if (citySchools.length === 0) return null;

                return (
                  <div key={city.id}>
                    <div className="mb-5 flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{city.name}</p>
                        <h3 className="mt-1 text-xl font-bold text-primary">{t(`destinations.citySchoolTitle`)} {city.name}</h3>
                      </div>
                      <p className="text-xs leading-6 text-muted-foreground">
                        {citySchools.length} {t("destinations.compareHeaders.featuredLabel")}
                      </p>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      {citySchools.map((school) => (
                        <article key={school.name} className="border border-border bg-background p-6 shadow-surface sm:p-7">
                          <div className="flex flex-col gap-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                {school.logoUrl ? (
                                  <div className="mb-5 flex min-h-28 w-full items-center justify-center border border-border bg-white px-5 py-4 sm:min-h-32 sm:px-7">
                                    <img
                                      src={school.logoUrl}
                                      alt={`${school.name} logo`}
                                      className="h-auto max-h-24 w-auto max-w-[300px] object-contain sm:max-h-28 sm:max-w-[360px]"
                                      loading="lazy"
                                      onError={(event) => {
                                        event.currentTarget.style.display = "none";
                                      }}
                                    />
                                  </div>
                                ) : null}

                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-strong">
                                  <Building2 className="h-3.5 w-3.5" />
                                  {school.location}
                                </div>
                                <h4 className="mt-2 text-2xl font-bold leading-tight text-primary sm:text-3xl">{school.name}</h4>
                              </div>

                              <span className="shrink-0 border border-border bg-editorial-paper px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                {t("destinations.institutionCredential")}
                              </span>
                            </div>

                            <p className="text-sm leading-7 text-muted-foreground">{t(school.descriptionKey)}</p>

                            <div className="grid gap-2 sm:grid-cols-3">
                              <div className="border border-border bg-editorial-paper p-4">
                                <GraduationCap className="h-4 w-4 text-brand-strong" />
                                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                                  {t("destinations.languageYearFocus")}
                                </p>
                                <ul className="mt-2 space-y-1.5">
                                  {school.focusKeys.map((focusKey) => (
                                    <li key={focusKey} className="text-xs leading-5 text-primary">{t(focusKey)}</li>
                                  ))}
                                </ul>
                              </div>

                              <div className="border border-border bg-editorial-paper p-4">
                                <BookOpenCheck className="h-4 w-4 text-brand-strong" />
                                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                                  {t("destinations.exams")}
                                </p>
                                <ul className="mt-2 space-y-1.5">
                                  {school.examKeys.map((exam) => (
                                    <li key={exam} className="text-xs leading-5 text-primary">{t(examLabelKey(exam), { defaultValue: exam })}</li>
                                  ))}
                                </ul>
                              </div>

                              <div className="border border-border bg-editorial-paper p-4">
                                <Home className="h-4 w-4 text-brand-strong" />
                                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                                  {t("destinations.studentServices")}
                                </p>
                                <ul className="mt-2 space-y-1.5">
                                  {school.serviceKeys.map((serviceKey) => (
                                    <li key={serviceKey} className="text-xs leading-5 text-primary">{t(serviceKey)}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="border-t border-border pt-5">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                  {t("destinations.credentialsTitle")}
                                </p>
                                <ShieldCheck className="h-4 w-4 text-trust" />
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {school.credentials.map((credential) => (
                                  <span key={credential} className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 text-xs font-semibold text-primary">
                                    {credential.includes("Award") || credential.includes("Excellence") ? (
                                      <Award className="h-3.5 w-3.5 text-brand-strong" />
                                    ) : (
                                      <ShieldCheck className="h-3.5 w-3.5 text-trust" />
                                    )}
                                    {credential}
                                  </span>
                                ))}
                              </div>
                              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                                {t(school.credentialsNoteKey ?? "destinations.disclosureBody")}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm">
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
                              <span className="text-xs text-muted-foreground">{t("destinations.lastVerified")}</span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-7 flex flex-col gap-2 border-t border-border pt-5">
              <p className="text-xs text-muted-foreground">{t("destinations.sourceNote")}</p>
              <p className="text-xs leading-6 text-muted-foreground">{t("destinations.logoNotice")}</p>
            </div>
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

            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tu9Universities.map((uni) => (
                <a
                  key={uni.name}
                  href={uni.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-h-40 flex-col justify-between border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-surface"
                >
                  <div className="flex h-16 items-center justify-start border-b border-border pb-4">
                    <img
                      src={uni.logoUrl}
                      alt={uni.name + " logo"}
                      className="max-h-12 max-w-[210px] object-contain object-left"
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-primary group-hover:text-brand-strong">{uni.name}</h3>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-brand-strong" />
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {uni.city}
                    </p>
                  </div>
                </a>
              ))}
            </div>

            <p className="mt-6 text-xs leading-6 text-muted-foreground">
              {t("destinations.universityLogoNote")}
            </p>
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

        <DarbContactCta />
      </main>

      <Footer />
    </div>
  );
};

export default EducationalDestinationsPage;
