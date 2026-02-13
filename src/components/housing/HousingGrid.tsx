import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchFilters } from '@/pages/HousingPage';
import HousingCard from './HousingCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface HousingGridProps {
  filters: SearchFilters;
  page: number;
  onPageChange: (page: number) => void;
}

const HousingGrid: React.FC<HousingGridProps> = ({ filters, page, onPageChange }) => {
  const { t } = useTranslation();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const fetchListings = async () => {
      if (!filters.city) return;
      
      setLoading(true);
      setError('');
      
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uniplaces-proxy`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'get-offers',
              city: filters.city,
              moveIn: filters.moveIn,
              moveOut: filters.moveOut,
              maxBudget: filters.maxBudget,
              rentType: filters.rentType,
              limit: 12,
              page: page,
            }),
          }
        );
        
        const data = await response.json();
        
        if (data.data) {
          setListings(data.data);
          // Calculate total pages from meta if available
          if (data.meta?.pagination) {
            setTotalPages(Math.ceil(data.meta.pagination.total / 12));
          }
        } else if (data.error) {
          setError(data.error);
        }
      } catch (err) {
        console.error('Error fetching listings:', err);
        setError(t('housing.fetchError', 'Failed to load listings. Please try again.'));
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [filters, page, t]);

  if (error) {
    return (
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900">{t('housing.error', 'Error')}</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : listings.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {listings.map((listing) => (
                <HousingCard
                  key={listing.id}
                  offer={listing}
                  city={filters.city}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  {t('housing.previous', 'Previous')}
                </Button>
                <span className="flex items-center px-4">
                  {t('housing.page', 'Page')} {page} {t('housing.of', 'of')} {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                >
                  {t('housing.next', 'Next')}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold mb-2">
              {t('housing.noResults', 'No listings found')}
            </h3>
            <p className="text-gray-600">
              {t('housing.tryAdjustingFilters', 'Try adjusting your filters to find more options')}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default HousingGrid;
