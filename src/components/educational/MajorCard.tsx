
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

// A subject keeps its small color tint even when the list is searched or filtered.
const categoryTints: Record<string, string> = {
  'health-medical': 'bg-tint-red',
  'engineering-technology': 'bg-tint-blue',
  'computer-it': 'bg-tint-purple',
  'natural-sciences': 'bg-tint-green',
  'social-sciences': 'bg-tint-pink',
  'business-management': 'bg-tint-orange',
  law: 'bg-tint-yellow',
  'arts-design': 'bg-tint-pink',
  education: 'bg-tint-blue',
  'agriculture-environment': 'bg-tint-green',
  'tourism-hospitality': 'bg-tint-orange',
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
      return parts.map((part, index) => regex.test(part) ? <mark key={index} className="rounded bg-highlight-surface px-1 text-primary">{part}</mark> : part);
    } catch {
      return text;
    }
  };

  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <button type="button" className="group flex h-full min-h-52 w-full flex-col rounded-2xl border border-border bg-card p-6 text-start shadow-quiet transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-quiet-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none" onClick={() => onMajorClick(major)}>
      <span className="mb-5 flex w-full items-center justify-between gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info-surface text-brand"><BookOpen className="size-5" /></span>
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground"><span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${categoryTints[major.categoryId] ?? 'bg-tint-blue'}`} /><span className="truncate">{catTitle}</span></span>
      </span>
      <span className="block w-full text-lg font-bold leading-snug text-primary">{searchQuery ? highlightText(loc.name, searchQuery) : loc.name}</span>
      <span className="mt-2 block w-full text-sm leading-relaxed text-muted-foreground">{searchQuery ? highlightText(loc.desc, searchQuery) : loc.desc}</span>
      <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-semibold text-brand">
        {t('educational.readMore')}<span className="sr-only">: {loc.name}</span><Arrow className="size-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
      </span>
    </button>
  );
};

export default MajorCard;
