
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MajorCategory } from '@/data/majorsData';
import { useTranslation } from 'react-i18next';

interface CategoryFilterProps {
  categories: MajorCategory[];
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string | null) => void;
  categoryMajorCounts: Record<string, number>;
}

const CategoryFilter = ({ categories, selectedCategory, onCategorySelect, categoryMajorCounts }: CategoryFilterProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">{t('educational.filterByCategory')}</h3>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          onClick={() => onCategorySelect(null)}
          className={`text-sm ${selectedCategory === null ? "bg-orange-500 hover:bg-orange-600 text-white" : "text-gray-600 hover:text-orange-600"}`}
        >
          {t('educational.allMajors')}
          <Badge variant="secondary" className="ms-2">
            {Object.values(categoryMajorCounts).reduce((sum, count) => sum + count, 0)}
          </Badge>
        </Button>
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "default" : "outline"}
            onClick={() => onCategorySelect(category.id)}
            className={`text-sm ${selectedCategory === category.id ? "bg-orange-500 hover:bg-orange-600 text-white" : "text-gray-600 hover:text-orange-600"}`}
          >
            {category.title}
            <Badge variant="secondary" className="ms-2">
              {categoryMajorCounts[category.id] || 0}
            </Badge>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default CategoryFilter;
