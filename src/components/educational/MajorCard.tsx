
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
import { SubMajor } from '@/data/majorsData';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import { getLocalizedMajor } from '@/utils/majorLocale';

interface MajorCardProps {
  major: SubMajor & { categoryTitle: string; categoryTitleEN?: string };
  onMajorClick: (major: SubMajor) => void;
  searchQuery?: string;
}

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
    <Card className="group cursor-pointer overflow-hidden transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-surface-lg motion-reduce:transform-none" onClick={() => onMajorClick(major)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-brand-strong" />
              <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                {searchQuery ? highlightText(loc.name, searchQuery) : loc.name}
              </h3>
            </div>
            <Badge variant="outline" className="mb-3 text-xs">{catTitle}</Badge>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              {searchQuery ? highlightText(loc.desc, searchQuery) : loc.desc}
            </p>
            <div className="flex items-center gap-2 text-brand-strong transition-colors group-hover:text-primary">
              <span className="text-sm font-medium">{t('educational.readMore')}</span>
              <span className="sr-only">: {loc.name}</span>
              <Arrow className="h-4 w-4" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MajorCard;
