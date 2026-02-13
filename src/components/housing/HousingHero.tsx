import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin } from 'lucide-react';

interface HousingHeroProps {
  onCitySelect: (city: string) => void;
}

const HousingHero: React.FC<HousingHeroProps> = ({ onCitySelect }) => {
  const { t } = useTranslation();
  const [cities, setCities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState('');

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uniplaces-proxy`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-cities' }),
          }
        );
        const data = await response.json();
        if (data.data) {
          setCities(data.data);
        }
      } catch (error) {
        console.error('Error fetching cities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCities();
  }, []);

  const handleSelectCity = (cityId: string) => {
    setSelectedCity(cityId);
    onCitySelect(cityId);
  };

  return (
    <section className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          {t('housing.heroTitle', 'Find Your Student Accommodation')}
        </h1>
        <p className="text-lg opacity-90 mb-8">
          {t('housing.heroSubtitle', 'Browse verified apartments and rooms near your university')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <div className="w-full sm:w-auto">
            <Select value={selectedCity} onValueChange={handleSelectCity} disabled={loading}>
              <SelectTrigger className="bg-white text-gray-900 border-0 w-full sm:w-64">
                <SelectValue placeholder={t('housing.selectCity', 'Select a city')} />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <SelectItem value="" disabled>
                    {t('housing.loading', 'Loading cities...')}
                  </SelectItem>
                ) : (
                  cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {city.attributes?.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HousingHero;
