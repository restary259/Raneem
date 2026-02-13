import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { MapPin, Euro, AlertCircle } from 'lucide-react';
import BookingButton from './BookingButton';

interface HousingDetailModalProps {
  offer: any;
  city: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HousingDetailModal: React.FC<HousingDetailModalProps> = ({
  offer,
  city,
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const [showBooking, setShowBooking] = useState(false);

  const data = offer.attributes?.accommodation_offer;
  if (!data) return null;

  const price = Math.round((data.price?.amount || 0) / 100);
  const photos = data.photos || [];
  const cancellationPolicy = data.cancellation_policy || 'Not specified';
  const title = data.title || 'Accommodation';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {city}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Photo Carousel */}
          {photos.length > 0 ? (
            <Carousel className="w-full">
              <CarouselContent>
                {photos.map((photo: any, idx: number) => (
                  <CarouselItem key={idx}>
                    <img
                      src={`https://cdn-static.staging-uniplaces.com/property-photos/${photo.hash}/x-large.jpg`}
                      alt={`Property ${idx + 1}`}
                      className="w-full h-64 object-cover rounded-lg"
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {photos.length > 1 && (
                <>
                  <CarouselPrevious />
                  <CarouselNext />
                </>
              )}
            </Carousel>
          ) : (
            <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
              {t('housing.noPhotos', 'No photos available')}
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-2 p-4 bg-orange-50 rounded-lg">
            <Euro className="h-6 w-6 text-orange-500" />
            <span className="text-3xl font-bold">{price}</span>
            <span className="text-gray-600">{t('housing.perMonth', '/month')}</span>
          </div>

          {/* Description */}
          {data.description && (
            <div>
              <h3 className="font-semibold mb-2">{t('housing.description', 'Description')}</h3>
              <p className="text-gray-700 text-sm">{data.description}</p>
            </div>
          )}

          {/* Availability Rules */}
          {data.availability_rules && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                {t('housing.availability', 'Availability Rules')}
              </h3>
              <p className="text-sm text-gray-700">{data.availability_rules}</p>
            </div>
          )}

          {/* Cancellation Policy */}
          <div>
            <h3 className="font-semibold mb-2">
              {t('housing.cancellationPolicy', 'Cancellation Policy')}
            </h3>
            <p className="text-sm text-gray-700">{cancellationPolicy}</p>
          </div>

          {/* Booking Button */}
          {!showBooking && (
            <Button
              onClick={() => setShowBooking(true)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white text-lg py-6"
            >
              {t('housing.bookNow', 'Book Now')}
            </Button>
          )}

          {showBooking && (
            <BookingButton
              offer={offer}
              city={city}
              price={price}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HousingDetailModal;
