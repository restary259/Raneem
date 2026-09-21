
import React from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface NoResultsProps {
  onClearSearch: () => void;
  onClearCategory: () => void;
}

const NoResults = ({ onClearSearch, onClearCategory }: NoResultsProps) => {
  const { t } = useTranslation('common');
  return (
    <div className="text-center py-12 md:py-16">
      <div className="max-w-md mx-auto">
        <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40 md:h-16 md:w-16" />
        <h3 className="mb-2 text-lg font-semibold text-foreground md:text-xl">{t('educational.noResultsTitle')}</h3>
        <p className="mb-6 text-sm text-muted-foreground md:text-base">{t('educational.noResultsDesc')}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onClearSearch} className="px-4 text-sm md:px-6 md:text-base">{t('educational.clearSearch')}</Button>
          <Button variant="outline" onClick={onClearCategory} className="px-4 text-sm md:px-6 md:text-base">{t('educational.showAllCategories')}</Button>
        </div>
      </div>
    </div>
  );
};

export default NoResults;
