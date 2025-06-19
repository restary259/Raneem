
import React from 'react';
import { Button } from '@/components/ui/button';
import { Country } from '../types';

interface CountryTabsProps {
  countries: Country[];
  activeCountry: string;
  onCountryChange: (countryCode: string) => void;
}

const CountryTabs: React.FC<CountryTabsProps> = ({
  countries,
  activeCountry,
  onCountryChange
}) => {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {countries.map((country) => (
        <Button
          key={country.code}
          variant={activeCountry === country.code ? "default" : "outline"}
          className={`
            px-4 md:px-6 py-2 md:py-3 rounded-full transition-all duration-200 text-sm md:text-base
            ${activeCountry === country.code 
              ? 'bg-primary text-white shadow-lg border-b-4 border-orange-400' 
              : 'hover:bg-primary/10'
            }
          `}
          onClick={() => onCountryChange(country.code)}
        >
          <span className="text-lg mr-2">{country.flag}</span>
          {country.name}
        </Button>
      ))}
    </div>
  );
};

export default CountryTabs;
