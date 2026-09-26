
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  'health-medical': 'bg-story-coral',
  'engineering-technology': 'bg-story-sky',
  'computer-it': 'bg-story-plum',
  'natural-sciences': 'bg-story-mint',
  'social-sciences': 'bg-story-rose',
  'business-management': 'bg-story-peach',
  law: 'bg-story-lime',
  'arts-design': 'bg-story-rose',
  education: 'bg-story-sky',
  'agriculture-environment': 'bg-story-mint',
  'tourism-hospitality': 'bg-story-peach',
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
      return parts.map((part, index) => regex.test(part) ? <mark key={index} className="rounded bg-brand/20 px-1 text-primary">{part}</mark> : part);
    } catch {
      return text;
    }
  };

  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <Button type="button" variant="ghost" className={`group h-auto min-h-36 w-full items-start overflow-hidden rounded-lg border border-primary/10 p-0 text-start text-primary whitespace-normal shadow-xs transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-surface-lg focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none ${categorySurfaces[major.categoryId] ?? 'bg-story-sky'}`} onClick={() => onMajorClick(major)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 shrink-0 text-primary" />
              <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                {searchQuery ? highlightText(loc.name, searchQuery) : loc.name}
              </h3>
            </div>
            <Badge variant="outline" className="mb-3 border-primary/25 bg-background/35 text-xs text-primary">{catTitle}</Badge>
            <p className="mb-4 text-sm leading-relaxed text-primary/80">
              {searchQuery ? highlightText(loc.desc, searchQuery) : loc.desc}
            </p>
            <div className="flex items-center gap-2 text-primary transition-colors group-hover:underline">
              <span className="text-sm font-medium">{t('educational.readMore')}</span>
              <span className="sr-only">: {loc.name}</span>
              <Arrow className="h-4 w-4" />
            </div>
          </div>
        </div>
      </CardContent>
    </Button>
  );
};

export default MajorCard;
