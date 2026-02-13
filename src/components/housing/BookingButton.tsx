import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

interface BookingButtonProps {
  offer: any;
  city: string;
  price: number;
}

const BookingButton: React.FC<BookingButtonProps> = ({ offer, city, price }) => {
  const { t } = useTranslation();
  const [moveIn, setMoveIn] = useState('');
  const [moveOut, setMoveOut] = useState('');
  const [guests, setGuests] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!moveIn || !moveOut) {
      setError(t('housing.dateRequired', 'Please enter move-in and move-out dates'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uniplaces-proxy`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'calculate-pricing',
            offerId: offer.id,
            moveIn,
            moveOut,
            guests: parseInt(guests),
          }),
        }
      );

      const data = await response.json();

      if (data.redirect_url) {
        window.open(data.redirect_url, '_blank');
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error('Booking error:', err);
      setError(t('housing.bookingError', 'Failed to initiate booking. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold">{t('housing.bookingDetails', 'Booking Details')}</h3>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleBooking} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            {t('housing.filterMoveIn', 'Move-in Date')} *
          </label>
          <Input
            type="date"
            value={moveIn}
            onChange={(e) => setMoveIn(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t('housing.filterMoveOut', 'Move-out Date')} *
          </label>
          <Input
            type="date"
            value={moveOut}
            onChange={(e) => setMoveOut(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {t('housing.guests', 'Number of Guests')}
          </label>
          <Input
            type="number"
            min="1"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {loading ? t('housing.processing', 'Processing...') : t('housing.continueToCheckout', 'Continue to Checkout')}
        </Button>
      </form>

      <p className="text-xs text-gray-600 text-center">
        {t('housing.poweredBy', 'Powered by Uniplaces')}
      </p>
    </Card>
  );
};

export default BookingButton;
