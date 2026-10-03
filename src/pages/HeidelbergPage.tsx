import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronDown, Castle, Waves, GraduationCap, Footprints, Landmark } from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import {
  HEIDELBERG_COPY,
  HEIDELBERG_GALLERY,
  HEIDELBERG_HERO,
  HEIDELBERG_HERO_CHIPS,
  HEIDELBERG_HIGHLIGHTS,
  HEIDELBERG_SECTIONS,
  HEIDELBERG_SUNSET,
  HEIDELBERG_TOP_PLACES,
  type HighlightIcon,
  type Lang,
  type L10n,
} from "@/data/heidelberg";

const ICONS: Record<HighlightIcon, typeof Castle> = {
  castle: Castle,
  river: Waves,
  university: GraduationCap,
  walk: Footprints,
  oldtown: Landmark,
};

function useLang(): Lang {
  const { i18n } = useTranslation();
  const l = (i18n.language || "ar").slice(0, 2);
  return l === "en" || l === "he" ? l : "ar";
}

const N = HEIDELBERG_SECTIONS.length;

export default function HeidelbergPage() {
  const lang = useLang();
  const { dir, isRtl } = useDirection();
  const tr = (v: L10n) => v[lang];
  const [active, setActive] = useState(HEIDELBERG_SECTIONS[0].id);
  const [railVisible, setRailVisible] = useState(false);
  const fillRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const activeIdx = HEIDELBERG_SECTIONS.findIndex((s) => s.id === active);

  // Smooth journey rail: progress is piecewise per section so the dots line up,
  // and the drawn value eases toward the target every animation frame.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target = 0;
    let current = 0;
    let raf = 0;
    let lastActive = "";
    let lastVisible = false;

    const measure = () => {
      const els = HEIDELBERG_SECTIONS.map((s) => document.getElementById(`hd-${s.id}`));
      if (els.some((e) => !e)) return;
      const tops = els.map((e) => e!.getBoundingClientRect().top + window.scrollY);
      const lastEl = els[N - 1]!;
      const end = lastEl.getBoundingClientRect().bottom + window.scrollY;
      const y = window.scrollY + window.innerHeight * 0.4;
      let i = 0;
      while (i < N - 1 && y >= tops[i + 1]) i++;
      const next = i < N - 1 ? tops[i + 1] : end;
      const frac = Math.min(1, Math.max(0, (y - tops[i]) / Math.max(1, next - tops[i])));
      target = y < tops[0] ? 0 : Math.min(1, (i + (i < N - 1 ? frac : 0)) / (N - 1));
      const id = HEIDELBERG_SECTIONS[i].id;
      if (id !== lastActive) {
        lastActive = id;
        setActive(id);
      }
      const vis = window.scrollY + window.innerHeight * 0.6 > tops[0] && window.scrollY + window.innerHeight * 0.3 < end;
      if (vis !== lastVisible) {
        lastVisible = vis;
        setRailVisible(vis);
      }
    };

    const tick = () => {
      measure();
      current = reduce ? target : current + (target - current) * 0.12;
      if (Math.abs(target - current) < 0.0005) current = target;
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${current})`;
      if (tipRef.current) tipRef.current.style.transform = `translateY(${current * 100}%)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Keep the active chip visible inside the horizontal mini-nav.
  useEffect(() => {
    const chip = document.getElementById(`hd-nav-${active}`);
    const row = chip?.parentElement;
    if (!chip || !row) return;
    const target = chip.offsetLeft - (row.clientWidth - chip.clientWidth) / 2;
    row.scrollTo({ left: target, behavior: "smooth" });
  }, [active]);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-grow">
        {/* Full-screen opening photo */}
        <section className="relative isolate flex min-h-[88svh] items-end overflow-hidden bg-primary text-primary-foreground">
          <img
            src={HEIDELBERG_HERO.url}
            alt={tr(HEIDELBERG_HERO.alt)}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 -z-10 size-full object-cover"
          />
          <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-primary/85 via-primary/25 to-transparent" />
          <div className="container pb-14 pt-32 sm:pb-20">
            <p className="text-sm font-semibold tracking-wide text-highlight">Heidelberg · Baden-Württemberg</p>
            <h1 className="mt-3 max-w-3xl text-balance font-editorial text-5xl leading-[1.05] sm:text-7xl">
              {tr(HEIDELBERG_COPY.heroTitle)}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-primary-foreground/90">{tr(HEIDELBERG_COPY.heroSubtitle)}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {HEIDELBERG_HERO_CHIPS.map((c) => (
                <li key={c.en} className="rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-4 py-1.5 text-sm font-medium backdrop-blur">
                  {tr(c)}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => go("hd-glance")}
              className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-primary-foreground/90 hover:text-highlight"
            >
              {tr(HEIDELBERG_COPY.explore)}
              <ChevronDown className="size-5 animate-bounce motion-reduce:animate-none" />
            </button>
          </div>
          <span aria-hidden className="darb-spectrum darb-spectrum-lg absolute inset-x-0 bottom-0 rounded-none" />
        </section>

        {/* At a glance */}
        <section id="hd-glance" className="container scroll-mt-20 py-14 sm:py-20">
          <h2 className="font-editorial text-3xl text-primary sm:text-4xl">{tr(HEIDELBERG_COPY.glanceTitle)}</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {HEIDELBERG_HIGHLIGHTS.map((h) => {
              const Icon = ICONS[h.icon];
              return (
                <div key={h.icon} className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-quiet transition-shadow hover:shadow-quiet-hover">
                  <span className="grid size-11 place-items-center rounded-full bg-highlight/15 text-brand-strong">
                    <Icon className="size-5" />
                  </span>
                  <p className="mt-4 font-semibold text-primary">{tr(h.title)}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{tr(h.text)}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top places carousel */}
        <section className="bg-muted/40 py-14 sm:py-20">
          <div className="container">
            <h2 className="font-editorial text-3xl text-primary sm:text-4xl">{tr(HEIDELBERG_COPY.placesTitle)}</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">{tr(HEIDELBERG_COPY.placesBody)}</p>
          </div>
          <div className="container mt-8">
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none]">
              {HEIDELBERG_TOP_PLACES.map((p) => (
                <figure
                  key={p.name}
                  className="group relative aspect-[3/4] w-[78%] shrink-0 snap-start overflow-hidden rounded-3xl bg-muted sm:w-[340px]"
                >
                  <img
                    src={p.photo.url}
                    alt={tr(p.photo.alt)}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/90 to-transparent p-5 pt-16 text-primary-foreground">
                    <p className="font-editorial text-2xl"><bdi>{p.name}</bdi></p>
                    <p className="mt-1 text-sm leading-6 text-primary-foreground/85">{tr(p.text)}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Section chips */}
        <nav
          aria-label={tr(HEIDELBERG_COPY.sectionsLabel)}
          className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur"
        >
          <div className="container flex min-w-0 gap-2 overflow-x-auto py-3 [scrollbar-width:none]">
            {HEIDELBERG_SECTIONS.map((s) => (
              <button
                key={s.id}
                id={`hd-nav-${s.id}`}
                type="button"
                onClick={() => go(`hd-${s.id}`)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                  active === s.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-primary",
                )}
              >
                {tr(s.nav)}
              </button>
            ))}
          </div>
        </nav>

        {/* Journey rail: fixed to the viewport so it travels with the reader */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none fixed bottom-10 start-2 top-36 z-20 w-0.5 rounded-full bg-border transition-opacity duration-500 sm:start-4 lg:start-6",
            railVisible ? "opacity-100" : "opacity-0",
          )}
        >
          <div ref={fillRef} className="absolute inset-0 origin-top rounded-full bg-highlight will-change-transform" style={{ transform: "scaleY(0)" }} />
          {HEIDELBERG_SECTIONS.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "absolute left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background transition-colors duration-300",
                i <= activeIdx ? "bg-highlight" : "bg-border",
              )}
              style={{ top: `${(i / (N - 1)) * 100}%` }}
            />
          ))}
          <div ref={tipRef} className="absolute inset-0 will-change-transform">
            <span className="absolute left-1/2 top-0 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-highlight shadow-[0_0_0_6px_hsl(var(--highlight)/0.25)]" />
          </div>
        </div>

        {/* Chapters */}
        <div className="container space-y-20 py-14 ps-8 sm:space-y-28 sm:py-20 sm:ps-12 lg:ps-16">
          <h2 className="font-editorial text-3xl text-primary sm:text-4xl">{tr(HEIDELBERG_COPY.guideTitle)}</h2>
          {HEIDELBERG_SECTIONS.map((s, i) => {
            const [cover, ...rest] = s.photos;
            return (
              <section key={s.id} id={`hd-${s.id}`} className="min-w-0 scroll-mt-36">
                <figure className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-muted sm:aspect-[21/9]">
                  <img
                    src={cover.url}
                    alt={tr(cover.alt)}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-700 hover:scale-[1.02] motion-reduce:transition-none"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/85 to-transparent p-5 pt-20 text-primary-foreground sm:p-8 sm:pt-24">
                    <p className="font-editorial text-2xl text-highlight">{String(i + 1).padStart(2, "0")}</p>
                    <h3 className="mt-1 text-balance font-editorial text-3xl sm:text-5xl">{tr(s.title)}</h3>
                  </figcaption>
                </figure>

                <div className={cn("mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12", i % 2 === 1 && "lg:[&>*:first-child]:order-2")}>
                  <div className="min-w-0 lg:col-span-7">
                    <p className="text-lg leading-9 text-muted-foreground">{tr(s.body)}</p>
                    {s.items && (
                      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {s.items.map((it) => (
                          <li key={it.name} className="min-w-0 rounded-2xl border border-border bg-card p-4">
                            <p className="font-semibold text-primary"><bdi>{it.name}</bdi></p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{tr(it.text)}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="min-w-0 space-y-3 lg:col-span-5">
                    {s.facts.length > 0 && (
                      <dl className="grid grid-cols-2 gap-3">
                        {s.facts.map((f) => (
                          <div key={f.value + f.label.en} className="min-w-0 rounded-2xl bg-highlight-surface p-4">
                            <dt className="text-xl font-bold text-primary"><bdi>{f.value}</bdi></dt>
                            <dd className="mt-1 text-xs leading-5 text-muted-foreground">{tr(f.label)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {rest.length > 0 && (
                      <div className={cn("grid gap-3", rest.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                        {rest.map((p) => (
                          <figure key={p.file} className="aspect-[4/3] min-w-0 overflow-hidden rounded-2xl bg-muted">
                            <img src={p.url} alt={tr(p.alt)} loading="lazy" decoding="async" className="size-full object-cover" />
                          </figure>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* Gallery mosaic */}
        <section className="container pb-14 sm:pb-20">
          <h2 className="font-editorial text-3xl text-primary sm:text-4xl">{tr(HEIDELBERG_COPY.galleryTitle)}</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:grid-rows-2">
            {HEIDELBERG_GALLERY.map((p, i) => (
              <figure
                key={p.file}
                className={cn(
                  "min-w-0 overflow-hidden rounded-2xl bg-muted",
                  i === 0 ? "col-span-2 aspect-[4/3] sm:row-span-2 sm:aspect-auto" : "aspect-square",
                )}
              >
                <img src={p.url} alt={tr(p.alt)} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-700 hover:scale-105 motion-reduce:transition-none" />
              </figure>
            ))}
          </div>
        </section>

        {/* Photo CTA */}
        <section id="hd-cta" className="relative isolate overflow-hidden">
          <img src={HEIDELBERG_SUNSET.url} alt={tr(HEIDELBERG_SUNSET.alt)} loading="lazy" decoding="async" className="absolute inset-0 -z-10 size-full object-cover" />
          <span aria-hidden className="absolute inset-0 -z-10 bg-primary/60" />
          <div className="container py-24 text-center text-primary-foreground sm:py-32">
            <h2 className="text-balance font-editorial text-4xl sm:text-6xl">{tr(HEIDELBERG_COPY.ctaTitle)}</h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/90">{tr(HEIDELBERG_COPY.ctaBody)}</p>
            <Button asChild size="lg" variant="cta" className="mt-8">
              <Link to="/apply">
                {tr(HEIDELBERG_COPY.ctaButton)}
                <Arrow />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
