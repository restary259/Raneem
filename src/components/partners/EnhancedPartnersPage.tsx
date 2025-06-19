
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CountryTabs from './components/CountryTabs';
import UniversityCarousel from './components/UniversityCarousel';
import LanguageSchoolCarousel from './components/LanguageSchoolCarousel';
import LocalServiceCarousel from './components/LocalServiceCarousel';
import { germanyUniversities, romaniaUniversities, jordanUniversities } from './data/universities';
import { germanyLanguageSchools } from './data/languageSchools';
import { germanyLocalServices } from './data/localServices';
import { countries } from './data/countries';
import { University } from './types';

const EnhancedPartnersPage = () => {
  const { t } = useTranslation('partners');
  const [activeCountry, setActiveCountry] = useState('germany');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const getUniversitiesForCountry = (country: string): University[] => {
    switch (country) {
      case 'germany': return germanyUniversities;
      case 'romania': return romaniaUniversities;
      case 'jordan': return jordanUniversities;
      default: return [];
    }
  };

  const universities = getUniversitiesForCountry(activeCountry);

  return (
    <div className="space-y-8">
      <CountryTabs
        countries={countries}
        activeCountry={activeCountry}
        onCountryChange={setActiveCountry}
      />

      <div className="space-y-8 md:space-y-12">
        <UniversityCarousel
          universities={universities}
          activeCountry={activeCountry}
          expandedCard={expandedCard}
          setExpandedCard={setExpandedCard}
        />

        {activeCountry === 'germany' && (
          <>
            <LanguageSchoolCarousel
              schools={germanyLanguageSchools}
              expandedCard={expandedCard}
              setExpandedCard={setExpandedCard}
            />
            <LocalServiceCarousel
              services={germanyLocalServices}
              expandedCard={expandedCard}
              setExpandedCard={setExpandedCard}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default EnhancedPartnersPage;
