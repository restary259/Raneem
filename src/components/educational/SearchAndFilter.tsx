
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, ChevronDown, X } from 'lucide-react';
import { majorsData } from '@/data/majorsData';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import { getLocalizedCategoryTitle } from '@/utils/majorLocale';

interface SearchAndFilterProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  filteredMajorsCount: number;
  allMajorsCount: number;
  categoryMajorCounts: Record<string, number>;
}

const SearchAndFilter = ({
  searchQuery, setSearchQuery, selectedCategory, setSelectedCategory,
  showFilters, setShowFilters, filteredMajorsCount, allMajorsCount, categoryMajorCounts
}: SearchAndFilterProps) => {
  const { t, i18n } = useTranslation('common');
  const { dir, isRtl } = useDirection();
  const lang = i18n.language;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lock background scroll + Escape to close while open
  useEffect(() => {
    if (!showFilters) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowFilters(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [showFilters, setShowFilters]);

  return (
    <section className="educational-sticky-section sticky z-40 border-b border-border bg-background/95 shadow-xs backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="relative">
            <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground md:h-5 md:w-5 ${isRtl ? 'right-3' : 'left-3'}`} />
            <Input
              type="text"
              placeholder={t('educational.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`h-12 rounded-full border-border bg-muted/40 text-sm transition-colors focus:border-primary focus:bg-background md:text-base ${isRtl ? 'pl-4 pr-10' : 'pr-4 pl-10'}`}
              dir={dir}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 whitespace-nowrap px-4 text-xs transition-colors hover:border-primary sm:text-sm"
              aria-expanded={showFilters}
              aria-haspopup="true"
            >
              <Filter className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">{t('educational.filterByCategory')}</span>
              <span className="sm:hidden">{t('educational.filterByCategory').split(' ')[0]}</span>
              <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            <div className="flex-shrink-0 text-end text-xs text-muted-foreground md:text-sm">
              {searchQuery || selectedCategory
                ? t('educational.foundResults', { count: filteredMajorsCount })
                : t('educational.availableMajors', { count: allMajorsCount })
              }
            </div>
          </div>
        </div>
      </div>

      {/* Portaled to body: the sticky bar's backdrop-blur would otherwise trap position:fixed. */}
      {showFilters && mounted && createPortal(
        <div dir={dir}>
          <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-xs" onClick={() => setShowFilters(false)} data-testid="filter-backdrop" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('educational.filterByCategory')}
            className="fixed inset-x-0 bottom-0 z-[1001] flex max-h-[80dvh] w-full flex-col rounded-t-2xl bg-background shadow-surface-lg animate-in slide-in-from-bottom-4 md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[70vh] md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30 md:hidden" />
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-base font-bold text-foreground">{t('educational.filterByCategory')}</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowFilters(false)} className="h-8 w-8" aria-label={t('common.close', 'Close')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-4">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => { setSelectedCategory(null); setShowFilters(false); }}
                className="w-full justify-between text-sm"
              >
                <span className="truncate">{t('educational.allMajors')}</span>
                <Badge variant="secondary" className="ms-2 flex-shrink-0">
                  {Object.values(categoryMajorCounts).reduce((sum, count) => sum + count, 0)}
                </Badge>
              </Button>
              {majorsData.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => { setSelectedCategory(category.id); setShowFilters(false); }}
                  className="w-full justify-between text-sm"
                >
                  <span className="truncate">{getLocalizedCategoryTitle(category.title, category.titleEN, lang)}</span>
                  <Badge variant="secondary" className="ms-2 flex-shrink-0">{categoryMajorCounts[category.id] || 0}</Badge>
                </Button>
              ))}
            </div>
            <div className="pb-[max(env(safe-area-inset-bottom),0.75rem)]" />
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
};

export default SearchAndFilter;
