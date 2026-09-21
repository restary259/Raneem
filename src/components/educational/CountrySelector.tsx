
import React from 'react';

interface Country {
  code: string;
  name: string;
  flag: string;
  color: string;
}

interface CountrySelectorProps {
  countries: Country[];
  selectedCountry: string;
  onCountrySelect: (countryCode: string) => void;
}

const CountrySelector: React.FC<CountrySelectorProps> = ({
  countries,
  selectedCountry,
  onCountrySelect
}) => {
  return (
    <section className="bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="flex justify-center mb-12">
          <div className="flex gap-2 rounded-full bg-muted p-2 sm:gap-4">
            {countries.map((country) => (
              <button
                key={country.code}
                onClick={() => onCountrySelect(country.code)}
                className={`flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 transition-all duration-200 sm:px-6 ${
                  selectedCountry === country.code
                    ? 'bg-primary text-primary-foreground shadow-surface'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground'
                }`}
              >
                <span className="text-2xl">{country.flag}</span>
                <span className="font-medium">{country.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CountrySelector;
