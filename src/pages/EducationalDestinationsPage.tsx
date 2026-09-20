import React from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Building2, Heart } from 'lucide-react';
import UniversityCard from '@/components/educational/UniversityCard';
import LanguageSchoolCard from '@/components/educational/LanguageSchoolCard';
import ServiceCard from '@/components/educational/ServiceCard';
import { universities, languageSchools, services } from '@/data/educationalDestinations';
import SEOHead from '@/components/common/SEOHead';
import DarbPageHero from '@/components/common/DarbPageHero';
import DarbContactCta from '@/components/common/DarbContactCta';
import { DARB_PUBLIC_HERO_IMAGES } from '@/config/publicHeroImages';

import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

const EducationalDestinationsPage = () => {
  const { t } = useTranslation('common');
  const { dir } = useDirection();

  return <div className="min-h-screen bg-background" dir={dir}>
      <SEOHead title={t('seo.edDestTitle')} description={t('seo.edDestDesc')} />
      <Header />
      <DarbPageHero
        eyebrow={t('educational.edHeroBadge')}
        imageUrl={DARB_PUBLIC_HERO_IMAGES.destinations}
        imageAlt={t('educational.edImageAlt', 'Students on a bright German university campus')}
        title={t('educational.edHeroTitle')}
        subtitle={t('educational.edHeroSubtitle')}
      />
      <div className="container mx-auto px-4">
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
            <GraduationCap className="h-8 w-8 text-brand-strong" />{t('educational.edUniversitiesTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {universities.germany.map((uni, index) => <UniversityCard key={index} university={uni} />)}
          </div>
        </div>
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
            <Building2 className="h-8 w-8 text-brand-strong" />{t('educational.edLanguageSchoolsTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {languageSchools.germany.map((school, index) => <LanguageSchoolCard key={index} school={school} />)}
          </div>
        </div>
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
            <Heart className="h-8 w-8 text-brand-strong" />{t('educational.edServicesTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {services.germany.map((service, index) => <ServiceCard key={index} service={service} />)}
          </div>
        </div>
      </div>
      <DarbContactCta />
      <Footer />
    </div>;
};
export default EducationalDestinationsPage;
