import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SearchFilters } from '@/pages/HousingPage';
import { Filter } from 'lucide-react';

interface HousingFiltersProps {
  filters: SearchFilters;
  onFilterChange: (filters: Partial<SearchFilters>) => void;
}

const HousingFilters: React.FC<HousingFiltersProps> = ({ filters, onFilterChange }) => {
  const { t } = useTranslation();

  const rentTypes = [
    { value: '', label: t('housing.allRentTypes', 'All Types') },
    { value: 'entire', label: t('housing.entirePlace', 'Entire Place') },
    { value: 'private', label: t('housing.privateBedroom', 'Private Bedroom') },
    { value: 'shared', label: t('housing.sharedBedroom', 'Shared Bedroom') },
  ];

  return (
    <section className="bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Filter className="h-5 w-5 text-orange-500" />
          <h2 className="text-xl font-semibold">{t('housing.filters', 'Search Filters')}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Move-in Date */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('housing.filterMoveIn', 'Move-in Date')}
            </label>
            <Input
              type="date"
              value={filters.moveIn}
              onChange={(e) => onFilterChange({ moveIn: e.target.value })}
              className="w-full"
            />
          </div>

          {/* Move-out Date */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('housing.filterMoveOut', 'Move-out Date')}
            </label>
            <Input
              type="date"
              value={filters.moveOut}
              onChange={(e) => onFilterChange({ moveOut: e.target.value })}
              className="w-full"
            />
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('housing.filterBudget', 'Budget')} €{filters.maxBudget}/mo
            </label>
            <Slider
              value={[filters.maxBudget]}
              onValueChange={(value) => onFilterChange({ maxBudget: value[0] })}
              min={100}
              max={2000}
              step={50}
              className="w-full"
            />
          </div>

          {/* Rent Type */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('housing.filterRentType', 'Room Type')}
            </label>
            <Select value={filters.rentType} onValueChange={(value) => onFilterChange({ rentType: value })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('housing.selectType', 'Select type')} />
              </SelectTrigger>
              <SelectContent>
                {rentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HousingFilters;
