
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
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-center mb-12">
          <div className="flex gap-4 p-2 bg-gray-100 rounded-full">
            {countries.map((country) => (
              <button
                key={country.code}
                onClick={() => onCountrySelect(country.code)}
                className={`px-6 py-3 rounded-full transition-all duration-200 flex items-center gap-2 ${
                  selectedCountry === country.code
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'hover:bg-gray-200'
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
