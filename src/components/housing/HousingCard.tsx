import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Euro } from 'lucide-react';
import HousingDetailModal from './HousingDetailModal';

interface HousingCardProps {
  offer: any;
  city: string;
}

const HousingCard: React.FC<HousingCardProps> = ({ offer, city }) => {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  
  const data = offer.attributes?.accommodation_offer;
  if (!data) return null;

  const imageUrl = data.photos?.[0]?.hash
    ? `https://cdn-static.staging-uniplaces.com/property-photos/${data.photos[0].hash}/medium.jpg`
    : 'https://via.placeholder.com/300x200?text=No+Image';

  const price = Math.round((data.price?.amount || 0) / 100);
  const title = data.title || 'Accommodation';
  const rentType = data.rent_type || 'shared';

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
        <div className="relative h-48 overflow-hidden bg-gray-200">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        
        <CardHeader className="flex-1">
          <h3 className="font-semibold text-lg line-clamp-2">{title}</h3>
          <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
            <MapPin className="h-4 w-4" />
            <span>{city}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-1">
            <Euro className="h-5 w-5 text-orange-500" />
            <span className="text-2xl font-bold">{price}</span>
            <span className="text-sm text-gray-600">{t('housing.perMonth', '/month')}</span>
          </div>

          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
              {rentType === 'entire' && t('housing.entirePlace', 'Entire Place')}
              {rentType === 'private' && t('housing.privateBedroom', 'Private Bedroom')}
              {rentType === 'shared' && t('housing.sharedBedroom', 'Shared Bedroom')}
            </span>
          </div>

          <Button
            onClick={() => setShowDetails(true)}
            variant="outline"
            className="w-full"
            size="sm"
          >
            {t('housing.viewDetails', 'View Details')}
          </Button>
        </CardContent>
      </Card>

      <HousingDetailModal
        offer={offer}
        city={city}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  );
};

export default HousingCard;
