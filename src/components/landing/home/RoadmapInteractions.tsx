import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Link } from '@/lib/router-compat';
import { whatsappBusinessUrl } from '@/lib/contactConfig';
import { applicationPreview, roadmapTimeline } from '@/lib/roadmapPreview';
import { cn } from '@/lib/utils';
import castle from '@/assets/heidelberg/schloss.webp.asset.json';
import bridge from '@/assets/heidelberg/altebruecke.webp.asset.json';
import university from '@/assets/heidelberg/ub.webp.asset.json';

const choiceClass = 'h-auto min-h-12 justify-start whitespace-normal rounded-2xl border bg-background px-4 py-3 text-start text-foreground hover:bg-background hover:border-brand';
const selectedClass = 'border-brand ring-1 ring-brand';
export function ApplicationPreview() {
  const { t } = useTranslation('landing');
  const [step, setStep] = useState(2);
  const preview = applicationPreview(step);
  return <div className="space-y-3">
    {['personalStep', 'educationStep', 'companionStep', 'reviewStep'].map((key, i) => <Button key={key} variant="outline" aria-pressed={i < step} className={cn(choiceClass, 'w-full gap-3', i < step && selectedClass)} onClick={() => setStep(step === i + 1 ? i : i + 1)}><span className={cn('grid size-5 shrink-0 place-items-center rounded-full border border-border', i < step && 'bg-brand text-brand-foreground border-brand')}><Check className={cn('size-3', i >= step && 'invisible')} /></span><span className="flex-1">{t(`apply.${key}`)}</span><span dir="ltr" className="text-xs text-muted-foreground">{i + 1} / 4</span></Button>)}
    <progress className="roadmap-meter w-full" max={100} value={preview.percent} aria-label={t('apply.progressLabel')} />
    <div className="flex justify-between gap-3 text-xs text-muted-foreground" aria-live="polite"><span dir="ltr">{preview.percent}%</span><span>{t('homepage.roadmap.preview.remaining', { count: preview.remaining })}</span></div>
    <p className="text-xs leading-6 text-muted-foreground">{t('homepage.roadmap.preview.applicationNote')}</p>
  </div>;
}
export function ReviewPreview() {
  const { t } = useTranslation('landing');
  const items = t('homepage.roadmap.preview.review', { returnObjects: true }) as Array<{ title: string; body: string }>;
  const [checked, setChecked] = useState<number[]>([0]);
  return <div><div className="grid grid-cols-2 gap-3">{items.map((item, i) => <Button key={i} variant="outline" aria-pressed={checked.includes(i)} className={cn(choiceClass, 'block min-h-24', checked.includes(i) && selectedClass)} onClick={() => setChecked(old => old.includes(i) ? old.filter(n => n !== i) : [...old, i])}><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">{item.body}</span></Button>)}</div><p aria-live="polite" className="mt-3 text-xs leading-6 text-muted-foreground">{t('homepage.roadmap.preview.reviewCount', { count: checked.length })}</p></div>;
}
export function ChatPreview() {
  const { t } = useTranslation('landing');
  const qa = t('homepage.roadmap.preview.questions', { returnObjects: true }) as Array<{ question: string; answer: string }>;
  const [messages, setMessages] = useState<Array<{ index: number; answer: boolean }>>([]);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages]);
  const ask = (index: number) => {
    if (pending) return;
    setPending(true); setMessages(old => [...old.slice(-10), { index, answer: false }]);
    timer.current = setTimeout(() => { setMessages(old => [...old, { index, answer: true }]); setPending(false); }, 450);
  };
  return <div><p className="mb-3 text-xs font-semibold text-muted-foreground">{t('homepage.roadmap.preview.chatNote')}</p><div ref={log} role="log" aria-live="polite" className="flex max-h-72 min-h-40 flex-col gap-3 overflow-y-auto"><p className="max-w-[90%] self-start rounded-2xl bg-background px-4 py-3 text-sm leading-6">{t('homepage.roadmap.preview.greeting')}</p>{messages.map((m, i) => <p key={i} className={cn('max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6', m.answer ? 'self-start bg-background' : 'self-end bg-brand text-brand-foreground')}>{m.answer ? qa[m.index]?.answer : qa[m.index]?.question}</p>)}</div><div className="mt-4 flex flex-wrap gap-2">{qa.map((q, i) => <Button key={i} variant="outline" disabled={pending} className="h-auto min-h-10 whitespace-normal rounded-full text-start text-xs" onClick={() => ask(i)}>{q.question}</Button>)}</div><Button asChild variant="link" className="mt-3 h-auto whitespace-normal px-0 text-brand-strong"><a href={whatsappBusinessUrl(t('homepage.roadmap.preview.whatsappMessage'))} target="_blank" rel="noopener noreferrer"><MessageCircle />{t('homepage.actions.whatsapp')}</a></Button></div>;
}
export function LanguagePreview() {
  const { t } = useTranslation('landing');
  const [level, setLevel] = useState('C1');
  const [season, setSeason] = useState<'winter' | 'summer'>('winter');
  const [year, setYear] = useState(2027);
  const dates = roadmapTimeline(year, season);
  return <div><div role="group" aria-label={t('homepage.languagePrep.levelSelector')} dir="ltr" className="grid grid-cols-5 gap-2">{['A1','A2','B1','B2','C1'].map(l => <Button key={l} variant="outline" aria-pressed={level === l} onClick={() => setLevel(l)} className={cn('min-h-12 px-0 rounded-xl', level === l && 'bg-brand text-brand-foreground border-brand hover:bg-brand hover:text-brand-foreground')}>{l}</Button>)}</div><p aria-live="polite" className="mt-4 min-h-28 text-sm leading-7">{t(`homepage.languagePrep.levels.${level}.canDo`)}</p><a className="text-xs text-brand-strong underline" href="https://www.coe.int/en/web/common-european-framework-reference-languages/table-1-cefr-3.3-common-reference-levels-global-scale" target="_blank" rel="noopener noreferrer">{t('homepage.languagePrep.cefrReferenceLink')}</a><div className="mt-5 border-t border-border pt-4"><h4 className="font-semibold">{t('homepage.roadmap.preview.timingTitle')}</h4><div role="group" aria-label={t('homepage.roadmap.preview.season')} className="mt-3 flex gap-2">{(['winter','summer'] as const).map(s => <Button key={s} variant="outline" aria-pressed={season === s} onClick={() => setSeason(s)} className={cn('h-auto min-h-11 flex-1 whitespace-normal rounded-full', season === s && selectedClass)}>{t(`homepage.roadmap.preview.${s}`)}</Button>)}</div><div role="group" aria-label={t('homepage.roadmap.preview.year')} dir="ltr" className="mt-2 flex gap-2">{[2027,2028,2029].map(y => <Button key={y} variant="outline" aria-pressed={year === y} onClick={() => setYear(y)} className={cn('flex-1 rounded-full', year === y && selectedClass)}>{y}</Button>)}</div><dl aria-live="polite" className="mt-4 space-y-3 text-sm">{Object.entries(dates).map(([key, date]) => <div key={key} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2"><dt>{t(`homepage.roadmap.preview.${key}`)}</dt><dd dir="ltr" className="font-semibold">{date}</dd></div>)}</dl><p className="mt-3 text-xs leading-6 text-muted-foreground">{t('homepage.roadmap.preview.timingNote')}</p></div></div>;
}
export function HousingPreview() {
  const { t } = useTranslation('landing');
  const [housing, setHousing] = useState('shared');
  return <div><RadioGroup value={housing} onValueChange={setHousing} aria-label={t('homepage.roadmap.preview.housingTitle')} className="grid grid-cols-2 gap-3">{['single','shared','dorm','host'].map(key => <label key={key} className={cn('flex min-h-24 cursor-pointer items-start gap-2 rounded-2xl border bg-background p-4', housing === key ? selectedClass : 'border-border')}><RadioGroupItem value={key} className="mt-1 shrink-0" /><span className="text-sm font-semibold">{t(`homepage.roadmap.preview.housing.${key}`)}</span></label>)}</RadioGroup><p className="mt-4 text-xs leading-6 text-muted-foreground">{t('homepage.roadmap.preview.housingNote')}</p><Button asChild variant="link" className="mt-2 h-auto whitespace-normal px-0 text-brand-strong"><a href={whatsappBusinessUrl(t('homepage.roadmap.preview.housingMessage', { housing: t(`homepage.roadmap.preview.housing.${housing}`) }))} target="_blank" rel="noopener noreferrer">{t('homepage.actions.whatsapp')}</a></Button></div>;
}
export function ArrivalPreview() {
  const { t } = useTranslation('landing');
  const [place, setPlace] = useState(0);
  const places = t('homepage.roadmap.preview.places', { returnObjects: true }) as string[];
  const assets = [castle, bridge, university];
  return <div><img src={assets[place]?.url} alt={places[place]} loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover" /><div role="group" aria-label={t('homepage.roadmap.preview.cityTitle')} className="mt-4 flex flex-wrap gap-2">{places.map((p,i) => <Button key={p} variant="outline" aria-pressed={place === i} onClick={() => setPlace(i)} className={cn('h-auto min-h-11 whitespace-normal rounded-full', place === i && selectedClass)}>{p}</Button>)}</div><Button asChild variant="link" className="mt-3 px-0 text-brand-strong"><Link to="/heidelberg">{t('homepage.roadmap.stages.5.action')}</Link></Button></div>;
}
