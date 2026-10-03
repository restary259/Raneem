import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import DarbPageHero from "@/components/common/DarbPageHero";
import { Button } from "@/components/ui/button";
import { useDirection } from "@/hooks/useDirection";
import { cn } from "@/lib/utils";
import {
  HEIDELBERG_COPY,
  HEIDELBERG_HERO,
  HEIDELBERG_SECTIONS,
  type Lang,
  type L10n,
} from "@/data/heidelberg";

function useLang(): Lang {
  const { i18n } = useTranslation();
  const l = (i18n.language || "ar").slice(0, 2);
  return l === "en" || l === "he" ? l : "ar";
}

export default function HeidelbergPage() {
  const lang = useLang();
  const { dir, isRtl } = useDirection();
  const tr = (v: L10n) => v[lang];
  const [active, setActive] = useState(HEIDELBERG_SECTIONS[0].id);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting);
        if (vis.length) setActive(vis[0].target.id.replace("hd-", ""));
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    HEIDELBERG_SECTIONS.forEach((s) => {
      const el = document.getElementById(`hd-${s.id}`);
      if (el) obs.observe(el);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      obs.disconnect();
    };
  }, []);

  // Keep the active chip visible inside the horizontal mini-nav.
  useEffect(() => {
    const chip = document.getElementById(`hd-nav-${active}`);
    const row = chip?.parentElement;
    if (!chip || !row) return;
    // Scroll only the chip row horizontally; never move the page.
    const target = chip.offsetLeft - (row.clientWidth - chip.clientWidth) / 2;
    row.scrollTo({ left: target, behavior: "smooth" });
  }, [active]);

  const go = (id: string) => {
    document.getElementById(`hd-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-grow">
        <DarbPageHero
          imageUrl={HEIDELBERG_HERO.url}
          imageAlt={tr(HEIDELBERG_HERO.alt)}
          title={tr(HEIDELBERG_COPY.heroTitle)}
          subtitle={tr(HEIDELBERG_COPY.heroSubtitle)}
        />

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
                onClick={() => go(s.id)}
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
          <div className="h-0.5 w-full bg-border">
            <div
              className="h-full bg-highlight transition-[width] duration-150"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </nav>

        <div className="container space-y-16 py-12 sm:space-y-24 sm:py-16">
          {HEIDELBERG_SECTIONS.map((s, i) => (
            <section
              key={s.id}
              id={`hd-${s.id}`}
              className="grid min-w-0 scroll-mt-36 grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12"
            >
              <div className={cn("min-w-0 lg:col-span-5", i % 2 === 1 && "lg:order-2")}>
                <p className="text-xs font-bold tracking-[0.18em] text-brand-strong">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-2 text-balance text-3xl font-bold text-primary sm:text-4xl">
                  {tr(s.title)}
                </h2>
                <p className="mt-4 leading-8 text-muted-foreground">{tr(s.body)}</p>

                {s.items && (
                  <ul className="mt-6 space-y-3">
                    {s.items.map((it) => (
                      <li key={it.name} className="border-s-2 border-highlight ps-4">
                        <p className="font-semibold text-primary" dir="ltr" style={{ textAlign: isRtl ? "right" : "left" }}>
                          {it.name}
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">{tr(it.text)}</p>
                      </li>
                    ))}
                  </ul>
                )}

                {s.facts.length > 0 && (
                  <dl className="mt-6 grid grid-cols-2 gap-3">
                    {s.facts.map((f) => (
                      <div key={f.value + f.label.en} className="min-w-0 rounded-xl border border-border bg-muted/40 p-3">
                        <dt className="text-lg font-bold text-primary" dir="ltr" style={{ textAlign: isRtl ? "right" : "left" }}>
                          {f.value}
                        </dt>
                        <dd className="mt-1 text-xs leading-5 text-muted-foreground">{tr(f.label)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>

              <div
                className={cn(
                  "grid min-w-0 gap-3 lg:col-span-7",
                  s.photos.length > 1 ? "grid-cols-2" : "grid-cols-1",
                )}
              >
                {s.photos.map((p, pi) => (
                  <figure
                    key={p.file}
                    className={cn(
                      "min-w-0 overflow-hidden rounded-2xl bg-muted",
                      s.photos.length === 3 && pi === 0 && "col-span-2",
                      s.photos.length === 1 ? "aspect-[16/10]" : "aspect-[4/3]",
                    )}
                  >
                    <img
                      src={p.url}
                      alt={tr(p.alt)}
                      title={`© ${p.author} / ${p.license} / Wikimedia Commons`}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover transition-transform duration-700 hover:scale-[1.02] motion-reduce:transition-none"
                    />
                  </figure>
                ))}
              </div>
            </section>
          ))}

          <section id="hd-cta" className="rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
            <h2 className="text-balance text-2xl font-bold sm:text-3xl">{tr(HEIDELBERG_COPY.ctaTitle)}</h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">{tr(HEIDELBERG_COPY.ctaBody)}</p>
            <Button asChild size="lg" variant="cta" className="mt-6">
              <Link to="/apply">
                {tr(HEIDELBERG_COPY.ctaButton)}
                <Arrow />
              </Link>
            </Button>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
