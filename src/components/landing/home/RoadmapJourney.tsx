import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/router-compat';
import { cn } from '@/lib/utils';
import { ApplicationPreview, ReviewPreview, ChatPreview, LanguagePreview, HousingPreview, ArrivalPreview } from './RoadmapInteractions';

type Stage = { title: string; body: string; darb: string; note?: string; action: string; href: string };
const interactions = [ApplicationPreview, ReviewPreview, ChatPreview, LanguagePreview, HousingPreview, ArrivalPreview];
const RoadmapJourney = () => {
  const { t } = useTranslation('landing');
  const stages = t('homepage.roadmap.stages', { returnObjects: true }) as Stage[];
  const [reached, setReached] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const markers = root.current?.querySelectorAll<HTMLElement>('[data-journey-stage]');
      if (!markers?.length) return;
      const probe = window.innerHeight * .55;
      const first = markers[0]?.getBoundingClientRect().top ?? 0;
      const last = markers[markers.length - 1]?.getBoundingClientRect().top ?? 0;
      const progress = Math.min(1, Math.max(0, (probe - first) / Math.max(1, last - first)));
      if (fill.current) fill.current.style.transform = `scaleY(${progress})`;
      setReached(Array.from(markers).filter(m => m.getBoundingClientRect().top < probe).length);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    if (root.current) observer.observe(root.current);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule); schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, []);
  if (!Array.isArray(stages)) return null;
  return <section aria-labelledby="homepage-roadmap-title" className="bg-background py-14 sm:py-20"><div className="container mx-auto max-w-6xl px-4 sm:px-6"><div className="max-w-3xl sm:ps-[68px]"><p className="text-sm font-semibold text-brand-strong">{t('homepage.roadmap.eyebrow')}</p><h2 id="homepage-roadmap-title" className="mt-3 text-3xl font-semibold leading-tight text-primary sm:text-4xl">{t('homepage.roadmap.title')}</h2><p className="mt-4 leading-7 text-muted-foreground">{t('homepage.roadmap.body')}</p></div><div ref={root} className="darb-journey mt-10"><span aria-hidden="true" className="darb-journey-rail"><span ref={fill} className="darb-journey-rail-fill" /></span>{stages.map((stage, index) => {
    const Interaction = interactions[index];
    return <article key={index} data-roadmap-station={index + 1} id={index === 5 ? 'journey-arrival' : undefined} className="darb-journey-stage"><span aria-hidden="true" data-journey-stage className={cn('darb-journey-marker', index < reached && 'is-reached')}>{index + 1}</span><div className="darb-journey-card min-w-0"><div className="grid min-w-0 items-center gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10"><div><h3 className="text-2xl font-semibold leading-snug text-primary sm:text-3xl">{stage.title}</h3><p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">{stage.body}</p><p className="mt-3 text-sm leading-7 text-muted-foreground">{stage.darb}</p>{stage.note && <p className="mt-3 text-xs leading-6 text-muted-foreground">{stage.note}</p>}<Button asChild variant="link" className="mt-3 h-auto justify-start whitespace-normal px-0 text-start text-brand-strong"><Link to={stage.href}>{stage.action}</Link></Button></div>{Interaction && <div className="min-w-0 rounded-2xl bg-muted p-4 sm:p-6"><Interaction /></div>}</div>{index === 2 && <div aria-label={t('homepage.proof.aria')} className="mt-10 grid grid-cols-2 gap-5 border-t border-border pt-5 sm:grid-cols-3"><div><b dir="ltr" className="block text-3xl font-semibold text-primary">16+</b><p className="mt-2 text-xs text-muted-foreground">{t('homepage.proof.students')}</p></div><div><b dir="ltr" className="block text-3xl font-semibold text-primary">6+</b><p className="mt-2 text-xs text-muted-foreground">{t('homepage.proof.partners')}</p></div><div className="col-span-2 sm:col-span-1"><b className="text-sm text-primary">{t('homepage.proof.arabicTitle')}</b><p className="mt-2 text-xs leading-6 text-muted-foreground">{t('homepage.proof.arabicBody')}</p></div></div>}</div></article>;
  })}</div></div></section>;
};
export default RoadmapJourney;
