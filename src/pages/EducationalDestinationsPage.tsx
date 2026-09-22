import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  ExternalLink,
  GraduationCap,
  Languages,
  MapPin,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import DarbPageHero from "@/components/common/DarbPageHero";
import DarbContactCta from "@/components/common/DarbContactCta";
import CityImage from "@/components/landing/home/CityImage";
import IdentityStage from "@/components/landing/home/IdentityStage";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router-compat";
import { useDirection } from "@/hooks/useDirection";
import { languageYearCities, languageYearSchools, tu9Universities } from "@/data/educationalDestinations";
import germanyHero from "@/assets/germany-home-hero.jpg";
import heidelbergImage from "@/assets/destinations/heidelberg.jpg";
import dusseldorfImage from "@/assets/destinations/dusseldorf.jpg";
import dortmundImage from "@/assets/destinations/dortmund.jpg";
import munsterImage from "@/assets/destinations/munster.jpg";
import berlinImage from "@/assets/destinations/berlin.jpg";

const destinationImages = {
  heidelberg: heidelbergImage,
  dusseldorf: dusseldorfImage,
  dortmund: dortmundImage,
  munster: munsterImage,
  berlin: berlinImage,
} as const;

const EducationalDestinationsPage = () => {
  const { t } = useTranslation("common");
  const { dir, isRtl } = useDirection();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const decisionPoints = [
    { icon: GraduationCap, title: t("destinations.selection1"), body: t("destinations.selection1Body") },
    { icon: Languages, title: t("destinations.selection2"), body: t("destinations.selection2Body") },
    { icon: Building2, title: t("destinations.selection3"), body: t("destinations.selection3Body") },
    { icon: MapPin, title: t("destinations.selection4"), body: t("destinations.selection4Body") },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground" dir={dir}>
      <Header />
      <main>
        <DarbPageHero
          imageUrl={germanyHero}
          imageAlt={t("educational.edImageAlt", "Bright German university environment")}
          title={t("pageHero.destinations.title", "Destinations")}
          subtitle={t("destinations.editorial.heroSubtitle")}
        >
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href="#destinations-cities">{t("destinations.editorial.exploreButton")}<Arrow /></a>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/35 bg-background/95 text-primary hover:bg-background">
              <Link to="/ai-advisor">{t("destinations.editorial.advisorButton")}<MessageCircle /></Link>
            </Button>
          </div>
        </DarbPageHero>

        <section className="border-b border-border bg-background py-14 sm:py-20" aria-labelledby="destination-choice-title">
          <div className="container">
            <div className="grid gap-9 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
              <div className="max-w-xl">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("destinations.introEyebrow")}</p>
                <h2 id="destination-choice-title" className="mt-3 text-balance text-3xl font-bold leading-tight text-primary sm:text-5xl">
                  {t("destinations.editorial.choiceTitle")}
                </h2>
                <p className="mt-4 text-base leading-8 text-muted-foreground">{t("destinations.editorial.choiceBody")}</p>
              </div>
              <div className="grid border-y border-border sm:grid-cols-2">
                {decisionPoints.map(({ icon: Icon, title, body }, index) => (
                  <article key={title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 border-b border-border py-5 last:border-b-0 sm:border-b-0 sm:border-e sm:px-5 sm:odd:border-b sm:last:border-e-0">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-editorial-paper text-primary"><Icon className="size-4.5" /></span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-brand-strong">{String(index + 1).padStart(2, "0")}</p>
                      <h3 className="mt-1 font-bold text-primary">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="destinations-cities" className="bg-editorial-paper py-14 sm:py-20" aria-labelledby="destination-cities-title">
          <div className="container">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("destinations.citiesEyebrow")}</p>
              <h2 id="destination-cities-title" className="mt-3 text-balance text-3xl font-bold leading-tight text-primary sm:text-5xl">{t("destinations.editorial.citiesTitle")}</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">{t("destinations.editorial.citiesBody")}</p>
            </div>

            <div className="mt-12 space-y-14 sm:space-y-20">
              {languageYearCities.map((city, index) => {
                const schools = languageYearSchools.filter((school) => school.city === city.id);
                const reversed = index % 2 === 1;
                return (
                  <article key={city.id} className="grid min-w-0 gap-0 overflow-hidden border border-border bg-background shadow-surface lg:grid-cols-12">
                    <div className={`relative min-h-[300px] lg:col-span-7 lg:min-h-[560px] ${reversed ? "lg:order-2" : ""}`}>
                      <CityImage src={city.imageUrl} fallbackSrc={destinationImages[city.id]} alt={t("destinations.editorial.cityImageAlt", { city: city.name })} city={city.name} className="absolute inset-0 size-full" imageClassName="transition-transform duration-700 hover:scale-[1.02] motion-reduce:transition-none" eager={index === 0} />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-hero-panel/80 via-transparent to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-primary-foreground sm:p-7">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground/70">{t(`destinations.cities.${city.id}.region`)}</p>
                          <h3 className="mt-1 font-editorial text-4xl sm:text-6xl">{city.name}</h3>
                        </div>
                        <span className="font-editorial text-5xl text-primary-foreground/35 sm:text-7xl">{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      {city.photoCredit ? <a href={city.photoCredit.url} target="_blank" rel="noopener noreferrer" className="absolute start-4 top-4 bg-hero-panel/70 px-2 py-1 text-[10px] text-primary-foreground/80 backdrop-blur-sm">{city.photoCredit.label}</a> : null}
                    </div>

                    <div className={`min-w-0 p-6 sm:p-8 lg:col-span-5 lg:p-10 ${reversed ? "lg:order-1" : ""}`}>
                      <p className="text-base leading-8 text-muted-foreground">{t(city.descriptionKey)}</p>

                      <dl className="mt-7 divide-y divide-border border-y border-border">
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                          <dt className="text-xs font-bold uppercase text-brand-strong">{t("destinations.editorial.study")}</dt>
                          <dd className="text-sm leading-6 text-foreground">{t("destinations.editorial.studyBody")}</dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                          <dt className="text-xs font-bold uppercase text-brand-strong">{t("destinations.editorial.language")}</dt>
                          <dd className="text-sm leading-6 text-foreground">{schools.map((school) => school.name).join(" · ")}</dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                          <dt className="text-xs font-bold uppercase text-brand-strong">{t("destinations.editorial.university")}</dt>
                          <dd className="text-sm leading-6 text-foreground">{t("destinations.editorial.universityBody")}</dd>
                        </div>
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                          <dt className="text-xs font-bold uppercase text-brand-strong">{t("destinations.editorial.life")}</dt>
                          <dd className="flex flex-wrap gap-2">{city.highlights.map((key) => <span key={key} className="rounded-full bg-editorial-paper px-3 py-1.5 text-xs font-semibold text-primary">{t(key)}</span>)}</dd>
                        </div>
                      </dl>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        <Button asChild variant="outline"><a href={city.cityUrl} target="_blank" rel="noopener noreferrer">{t("destinations.exploreCity")}<ExternalLink /></a></Button>
                        <Button asChild><Link to="/contact">{t("destinations.editorial.nextStep")}<Arrow /></Link></Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-background py-14 sm:py-20" aria-labelledby="destination-schools-title">
          <div className="container">
            <div className="grid gap-8 lg:grid-cols-[0.62fr_1.38fr]">
              <div className="lg:sticky lg:top-32 lg:self-start">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("destinations.schoolsEyebrow")}</p>
                <h2 id="destination-schools-title" className="mt-3 text-balance text-3xl font-bold leading-tight text-primary sm:text-5xl">{t("destinations.schoolsTitle")}</h2>
                <p className="mt-4 leading-7 text-muted-foreground">{t("destinations.schoolsBody")}</p>
                <p className="mt-5 border-s-2 border-brand ps-4 text-xs leading-6 text-muted-foreground">{t("destinations.sourceNote")}</p>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
                {languageYearSchools.map((school) => (
                  <IdentityStage key={school.name} name={school.name} imageUrl={school.logoUrl} href={school.officialUrl} meta={school.location} />
                ))}
              </div>
            </div>
            <p className="mt-6 text-xs leading-6 text-muted-foreground">{t("destinations.logoNotice")}</p>
          </div>
        </section>

        <section className="border-y border-border bg-editorial-paper py-14 sm:py-20" aria-labelledby="destination-universities-title">
          <div className="container">
            <div className="grid gap-8 lg:grid-cols-[0.62fr_1.38fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("destinations.tu9Eyebrow")}</p>
                <h2 id="destination-universities-title" className="mt-3 text-balance text-3xl font-bold leading-tight text-primary sm:text-5xl">{t("destinations.tu9Title")}</h2>
                <p className="mt-4 leading-7 text-muted-foreground">{t("destinations.editorial.tu9Body")}</p>
                <a href="https://www.tu9.de/en/" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 font-bold text-primary underline decoration-brand/50 underline-offset-4">{t("destinations.editorial.tu9Source")}<ArrowUpRight className="size-4" /></a>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
                {tu9Universities.map((university) => <IdentityStage key={university.name} name={university.name} imageUrl={university.logoUrl} href={university.url} meta={university.city} />)}
              </div>
            </div>
            <p className="mt-6 text-xs leading-6 text-muted-foreground">{t("destinations.universityLogoNote")}</p>
          </div>
        </section>

        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div className="container grid gap-7 py-14 sm:py-18 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand"><Sparkles className="me-2 inline size-4" />{t("destinations.disclosureTitle")}</p>
              <h2 className="mt-3 text-balance font-editorial text-4xl leading-tight sm:text-6xl">{t("destinations.endTitle")}</h2>
              <p className="mt-4 max-w-2xl leading-7 text-primary-foreground/75">{t("destinations.disclosureBody")}</p>
            </div>
            <Button asChild size="lg"><Link to="/apply">{t("destinations.endButton")}<Arrow /></Link></Button>
          </div>
          <span aria-hidden="true" className="darb-spectrum darb-spectrum-lg block rounded-none" />
        </section>

        <DarbContactCta />
      </main>
      <Footer />
    </div>
  );
};

export default EducationalDestinationsPage;
