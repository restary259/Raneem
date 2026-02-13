import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import SEOHead from '@/components/common/SEOHead';
import HousingHero from '@/components/housing/HousingHero';
import HousingFilters from '@/components/housing/HousingFilters';
import HousingGrid from '@/components/housing/HousingGrid';

export interface SearchFilters {
  city: string;
  moveIn: string;
  moveOut: string;
  maxBudget: number;
  rentType: string;
}

const HousingPage = () => {
  const { t } = useTranslation();
  const { dir } = useDirection();
  const [filters, setFilters] = useState<SearchFilters>({
    city: '',
    moveIn: '',
    moveOut: '',
    maxBudget: 1000,
    rentType: '',
  });
  const [currentPage, setCurrentPage] = useState(1);

  const handleFilterChange = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  }, []);

  return (
    <>
      <SEOHead
        title="Student Housing | Darb"
        description="Find your perfect student accommodation across European cities with Darb Housing."
      />
      <div className="min-h-screen bg-background" dir={dir}>
        <HousingHero onCitySelect={(city) => handleFilterChange({ city })} />
        
        {filters.city && (
          <>
            <HousingFilters 
              filters={filters}
              onFilterChange={handleFilterChange}
            />
            <HousingGrid 
              filters={filters}
              page={currentPage}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </>
  );
};

export default HousingPage;
