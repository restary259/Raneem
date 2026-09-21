import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Building2, Check, Compass, FileCheck2, Languages, Plane, ShieldCheck } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { useDirection } from "@/hooks/useDirection";

type JourneyStage = {
  title: string;
  problem: string;
  darb: string;
  decision: string;
  action: string;
  href: string;
};

const icons = [Compass, Languages, FileCheck2, ShieldCheck, Plane];

const ServicesGrid = () => {
  const { t } = useTranslation("services");
  const { isRtl } = useDirection();
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const stages = t("servicesJourney.stages", { returnObjects: true }) as JourneyStage[];

  return (
    <section className="bg-background py-14 sm:py-20" aria-labelledby="services-journey-title">
      <div className="container">
        <div className="grid gap-7 lg:grid-cols-[0.68fr_1.32fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">{t("servicesJourney.eyebrow")}</p>
            <h2 id="services-journey-title" className="mt-3 text-balance text-3xl font-bold text-primary sm:text-5xl">{t("servicesJourney.title")}</h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:justify-self-end">{t("servicesJourney.body")}</p>
        </div>

        <div className="mt-10 border-y border-border">
          {Array.isArray(stages) && stages.map((stage, index) => {
            const Icon = icons[index] ?? Check;
            return (
              <article key={stage.title} className="grid gap-5 border-b border-border py-7 last:border-b-0 sm:grid-cols-[auto_minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-7 sm:py-9">
                <div className="flex items-start gap-3 sm:block">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Icon className="size-5" /></span>
                  <span className="mt-3 block text-xs font-bold text-brand-strong">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-primary sm:text-2xl">{stage.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{stage.problem}</p>
                </div>
                <div className="min-w-0 rounded-lg bg-editorial-paper p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-strong">{t("servicesJourney.darbLabel")}</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{stage.darb}</p>
                  <div className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-xs leading-6 text-muted-foreground"><Building2 className="mt-0.5 size-4 shrink-0" /><span>{stage.decision}</span></div>
                  <Link to={stage.href} className="mt-4 inline-flex min-h-11 items-center gap-2 font-bold text-primary underline decoration-brand/40 underline-offset-4 hover:decoration-brand">{stage.action}<Arrow className="size-4" /></Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ServicesGrid;