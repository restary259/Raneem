import { useEffect, useRef, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  FileCheck2,
  Home,
  Languages,
  MessageCircle,
  Plane,
  SearchCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RoadmapStage = {
  title: string;
  body: string;
  darb: string;
  note?: string;
  action: string;
  href: string;
};

const STAGE_ICONS = [
  FileCheck2,
  SearchCheck,
  MessageCircle,
  Languages,
  Home,
  Plane,
];

const RoadmapJourney = () => {
  const { t } = useTranslation("landing");
  const stages = t("homepage.roadmap.stages", {
    returnObjects: true,
  }) as RoadmapStage[];
  const [open, setOpen] = useState<number | null>(null);
  const [reached, setReached] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  // Progress reflects how far the visitor has scrolled through the stations.
  // Values are written straight to the compositor (scale transforms only) so
  // scrolling never triggers a React re-render per frame.
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let target = 0;
    let current = 0;
    let lastReached = 0;
    let raf = 0;

    const measure = () => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const anchor = window.innerHeight * 0.55;
      const total = Math.max(1, rect.height - window.innerHeight * 0.25);
      const scrolled = anchor - rect.top;
      target = Math.min(1, Math.max(0, scrolled / total));

      let count = 0;
      for (const el of root.querySelectorAll<HTMLElement>(
        "[data-journey-stage]",
      )) {
        if (el.getBoundingClientRect().top < anchor) count += 1;
      }
      if (count !== lastReached) {
        lastReached = count;
        setReached(count);
      }
    };

    const tick = () => {
      measure();
      current = reduce ? target : current + (target - current) * 0.15;
      if (Math.abs(target - current) < 0.001) current = target;
      if (fillRef.current)
        fillRef.current.style.transform = `scaleY(${current})`;
      if (barRef.current) barRef.current.style.transform = `scaleX(${current})`;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!Array.isArray(stages) || stages.length === 0) return null;

  return (
    <section
      aria-labelledby="homepage-roadmap-title"
      className="darb-journey-section border-b border-border bg-background py-14 sm:py-18"
    >
      <div className="container">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-strong">
            {t("homepage.roadmap.eyebrow")}
          </p>
          <h2
            id="homepage-roadmap-title"
            className="mt-3 text-balance text-3xl font-bold leading-tight text-primary sm:text-4xl"
          >
            {t("homepage.roadmap.title")}
          </h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            {t("homepage.roadmap.body")}
          </p>
        </div>

        <div className="mt-7 flex items-center gap-4">
          <div
            className="darb-journey-progress h-1.5 flex-1"
            role="progressbar"
            aria-label={t("homepage.roadmap.progressLabel")}
            aria-valuemin={0}
            aria-valuemax={stages.length}
            aria-valuenow={reached}
          >
            <span ref={barRef} className="darb-journey-progress-fill" />
          </div>
          <p
            className="shrink-0 text-xs font-bold text-brand-strong tabular-nums"
            dir="ltr"
            aria-hidden="true"
          >
            {reached}/{stages.length}
          </p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("homepage.roadmap.tapHint")}
        </p>

        <div ref={rootRef} className="darb-journey mt-8">
          <span aria-hidden="true" className="darb-journey-rail">
            <span ref={fillRef} className="darb-journey-rail-fill" />
          </span>

          {stages.map((stage, index) => {
            const Icon = STAGE_ICONS[index] ?? FileCheck2;
            const isOpen = open === index;
            const done = index < reached;
            return (
              <article key={stage.title} className="darb-journey-stage">
                <span
                  aria-hidden="true"
                  data-journey-stage
                  className={cn("darb-journey-marker", done && "is-reached")}
                >
                  <Icon className="size-4" />
                </span>
                <div className="darb-journey-card min-w-0">
                  <p
                    className="text-xs font-bold text-brand-strong tabular-nums"
                    dir="ltr"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-1 text-lg font-bold leading-snug text-primary sm:text-xl">
                    {stage.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {stage.body}
                  </p>

                  <button
                    type="button"
                    className="darb-journey-toggle"
                    aria-expanded={isOpen}
                    aria-controls={`journey-detail-${index}`}
                    onClick={() => setOpen(isOpen ? null : index)}
                  >
                    {t("homepage.roadmap.detailsLabel")}
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform duration-200 motion-reduce:transition-none",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>

                  <div
                    id={`journey-detail-${index}`}
                    hidden={!isOpen}
                    className="darb-journey-detail"
                  >
                    <p className="text-sm leading-6 text-primary">
                      {stage.darb}
                    </p>
                    {stage.note ? (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {stage.note}
                      </p>
                    ) : null}
                    <Link
                      to={stage.href}
                      className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-brand-strong underline-offset-4 hover:underline"
                    >
                      {stage.action}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default RoadmapJourney;
