
import { Button } from '@/components/ui/button';
import { BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
import { SubMajor } from '@/data/majorsData';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import { getLocalizedMajor } from '@/utils/majorLocale';

interface MajorCardProps {
  major: SubMajor & { categoryTitle: string; categoryTitleEN?: string; categoryId: string };
  onMajorClick: (major: SubMajor) => void;
  searchQuery?: string;
}

// A subject keeps its color even when the list is searched or filtered.
const categorySurfaces: Record<string, string> = {
  'health-medical': 'bg-story-coral hover:bg-story-coral',
  'engineering-technology': 'bg-story-sky hover:bg-story-sky',
  'computer-it': 'bg-story-plum hover:bg-story-plum',
  'natural-sciences': 'bg-story-mint hover:bg-story-mint',
  'social-sciences': 'bg-story-rose hover:bg-story-rose',
  'business-management': 'bg-story-peach hover:bg-story-peach',
  law: 'bg-story-lime hover:bg-story-lime',
  'arts-design': 'bg-story-rose hover:bg-story-rose',
  education: 'bg-story-sky hover:bg-story-sky',
  'agriculture-environment': 'bg-story-mint hover:bg-story-mint',
  'tourism-hospitality': 'bg-story-peach hover:bg-story-peach',
};

const MajorCard = ({ major, onMajorClick, searchQuery }: MajorCardProps) => {
  const { t, i18n } = useTranslation('common');
  const { isRtl } = useDirection();
  const lang = i18n.language;
  const loc = getLocalizedMajor(major, lang);
  const catTitle = lang === 'en' ? (major.categoryTitleEN || major.categoryTitle) : major.categoryTitle;

  const highlightText = (text: string, query: string) => {
    if (!text || !query?.trim()) return text || '';
    try {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      const parts = text.split(regex).filter(Boolean);
      return parts.map((part, index) => regex.test(part) ? <mark key={index} className="rounded bg-story-foreground/20 px-1 text-story-foreground">{part}</mark> : part);
    } catch {
      return text;
    }
  };

  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <Button type="button" variant="ghost" className={`group relative isolate flex h-full min-h-52 w-full flex-col items-stretch overflow-hidden rounded-lg border border-story-foreground/15 p-0 text-start text-story-foreground whitespace-normal shadow-story transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:text-story-foreground hover:shadow-story-hover focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none ${categorySurfaces[major.categoryId] ?? 'bg-story-sky hover:bg-story-sky'}`} onClick={() => onMajorClick(major)}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-linear-to-b from-story-foreground/12 via-transparent to-foreground/35" />
      <span className="relative flex h-full w-full flex-col p-5 sm:p-6">
        <span className="mb-5 flex w-full items-start justify-between gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-story-foreground/20 bg-story-foreground/10 shadow-story-tray"><BookOpen className="size-5" /></span>
          <span className="max-w-[65%] rounded-full border border-story-foreground/15 bg-foreground/15 px-3 py-1.5 text-xs font-semibold leading-snug text-story-foreground/90 shadow-inner">{catTitle}</span>
        </span>
        <span className="block w-full text-lg font-bold leading-snug text-story-foreground">{searchQuery ? highlightText(loc.name, searchQuery) : loc.name}</span>
        <span className="mt-2 block w-full text-sm leading-relaxed text-story-foreground/85">{searchQuery ? highlightText(loc.desc, searchQuery) : loc.desc}</span>
        <span className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg border border-story-foreground/20 bg-story-foreground/15 px-4 py-3 text-sm font-bold text-story-foreground shadow-story-action transition-transform duration-200 group-active:translate-y-0.5 motion-reduce:transition-none">
          {t('educational.readMore')}<span className="sr-only">: {loc.name}</span><Arrow className="size-4" />
        </span>
      </span>
    </Button>
  );
};

export default MajorCard;
