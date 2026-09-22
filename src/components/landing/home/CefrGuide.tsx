import { useState } from "react";
import { ExternalLink, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CefrLevel = {
  label: string;
  group: string;
  canDo: string;
};

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
const CEFR_SOURCE = "https://www.coe.int/en/web/common-european-framework-reference-languages/table-1-cefr-3.3-common-reference-levels-global-scale";

const CefrGuide = () => {
  const { t } = useTranslation("landing");
  const [selected, setSelected] = useState<(typeof LEVELS)[number]>("A1");
  const levels = t("homepage.languagePrep.levels", { returnObjects: true }) as Record<string, CefrLevel>;
  const active = levels[selected];

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background" aria-labelledby="cefr-guide-title">
      <div className="grid gap-0 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="bg-primary p-5 text-primary-foreground sm:p-7">
          <span className="grid size-11 place-items-center rounded-full bg-brand text-brand-foreground">
            <Languages className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-brand">CEFR · A1–C1</p>
          <h3 id="cefr-guide-title" className="mt-2 text-2xl font-bold sm:text-3xl">{t("homepage.languagePrep.guideTitle")}</h3>
          <p className="mt-3 text-sm leading-7 text-primary-foreground/75">{t("homepage.languagePrep.cefrNote")}</p>
        </div>

        <div className="min-w-0 p-5 sm:p-7">
          <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0" role="tablist" aria-label={t("homepage.languagePrep.levelSelector")} dir="ltr">
            {LEVELS.map((level) => (
              <Button
                key={level}
                type="button"
                role="tab"
                aria-selected={selected === level}
                variant={selected === level ? "default" : "outline"}
                className="min-w-16 shrink-0 snap-start"
                onClick={() => setSelected(level)}
              >
                {level}
              </Button>
            ))}
          </div>

          <div key={selected} role="tabpanel" className="mt-5 animate-fade-in motion-reduce:animate-none">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h4 className="text-3xl font-bold text-primary">{active?.label ?? selected}</h4>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">{active?.group}</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">{active?.canDo}</p>
            <p className="mt-4 border-s-2 border-brand ps-3 text-xs leading-6 text-muted-foreground">{t("homepage.languagePrep.darbRole")}</p>
            <a href={CEFR_SOURCE} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-strong underline decoration-brand/40 underline-offset-4 hover:decoration-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {t("homepage.languagePrep.sourceLabel")}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CefrGuide;