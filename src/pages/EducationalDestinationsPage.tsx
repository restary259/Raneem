import React from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GraduationCap, Building2, Heart } from 'lucide-react';
import UniversityCard from '@/components/educational/UniversityCard';
import LanguageSchoolCard from '@/components/educational/LanguageSchoolCard';
import ServiceCard from '@/components/educational/ServiceCard';
import { universities, languageSchools, services } from '@/data/educationalDestinations';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

const EducationalDestinationsPage = () => {
  const { t } = useTranslation('common');
  const { dir } = useDirection();

  return <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <section className="py-20 bg-gradient-to-b from-orange-50 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 bg-orange-100 text-orange-800">{t('educational.edHeroBadge')}</Badge>
            <h1 className="text-5xl font-bold text-foreground mb-6">{t('educational.edHeroTitle')}</h1>
            <p className="text-xl text-muted-foreground mb-8">{t('educational.edHeroSubtitle')}</p>
          </div>
        </div>
      </section>
      <div className="container mx-auto px-4">
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
            <GraduationCap className="h-8 w-8 text-orange-500" />{t('educational.edUniversitiesTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {universities.germany.map((uni, index) => <UniversityCard key={index} university={uni} />)}
          </div>
        </div>
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
            <Building2 className="h-8 w-8 text-orange-500" />{t('educational.edLanguageSchoolsTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {languageSchools.germany.map((school, index) => <LanguageSchoolCard key={index} school={school} />)}
          </div>
        </div>
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 flex items-center justify-center gap-3">
            <Heart className="h-8 w-8 text-orange-500" />{t('educational.edServicesTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {services.germany.map((service, index) => <ServiceCard key={index} service={service} />)}
          </div>
        </div>
      </div>
      <section className="py-20 text-white bg-slate-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">{t('educational.edCtaTitle')}</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">{t('educational.edCtaSubtitle')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white hover:bg-gray-100 text-zinc-950">{t('educational.edCtaButton1')}</Button>
            <Button size="lg" variant="outline" className="border-white text-slate-950 bg-slate-50">{t('educational.edCtaButton2')}</Button>
          </div>
        </div>
      </section>
      <Footer />
    </div>;
};
export default EducationalDestinationsPage;
