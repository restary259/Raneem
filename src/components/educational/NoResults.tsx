
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
        <BookOpen className="h-12 w-12 md:h-16 md:w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg md:text-xl font-semibold text-gray-600 mb-2">{t('educational.noResultsTitle')}</h3>
        <p className="text-sm md:text-base text-gray-500 mb-6">{t('educational.noResultsDesc')}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onClearSearch} className="bg-orange-500 hover:bg-orange-600 text-sm md:text-base px-4 md:px-6">{t('educational.clearSearch')}</Button>
          <Button variant="outline" onClick={onClearCategory} className="border-orange-500 text-orange-500 hover:bg-orange-50 text-sm md:text-base px-4 md:px-6">{t('educational.showAllCategories')}</Button>
        </div>
      </div>
    </div>
  );
};

export default NoResults;
