
import React from 'react';
import { useTranslation } from 'react-i18next';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import EnhancedPartnersPage from '@/components/partners/EnhancedPartnersPage';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Users, GraduationCap, Award } from 'lucide-react';
import SEOHead from '@/components/common/SEOHead';
import PageHero from '@/components/common/PageHero';

const PartnersPage = () => {
  const { t } = useTranslation(['partners', 'common']);

  const statsKeys = ['trustedPartners', 'countries', 'students', 'experience'] as const;
  const statIcons = [Users, MapPin, GraduationCap, Award];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={t('seo.partnersTitle', { ns: 'common' })} description={t('seo.partnersDesc', { ns: 'common' })} />
      <Header />

      <PageHero variant="light" title={t('partnersPage.heroTitle')} badge={t('partnersPage.heroSubtitle')} />

      <section className="py-8 sm:py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {statsKeys.map((key, index) => {
              const Icon = statIcons[index];
              return (
                <Card key={key} className="text-center">
                  <CardContent className="p-4 sm:p-6">
                    <Icon className="h-8 w-8 sm:h-10 sm:w-10 text-primary mx-auto mb-2 sm:mb-4" />
                    <div className="text-2xl sm:text-3xl font-bold text-primary mb-1 sm:mb-2">{t(`partnersPage.stats.${key}.number`)}</div>
                    <div className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{t(`partnersPage.stats.${key}.label`)}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">{t(`partnersPage.stats.${key}.description`)}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-8 sm:py-12 md:py-20">
        <div className="container mx-auto px-4"><EnhancedPartnersPage /></div>
      </section>

      <section className="py-8 sm:py-12 md:py-20 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">{t('partnersPage.cta.title')}</h2>
          <p className="text-lg sm:text-xl mb-6 sm:mb-8 max-w-2xl mx-auto opacity-90">{t('partnersPage.cta.subtitle')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/partnership" className="bg-white text-primary px-6 sm:px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">{t('partnersPage.cta.button')}</a>
            <a href="/contact" className="border border-white text-white px-6 sm:px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors">{t('nav.contact', { ns: 'common' })}</a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PartnersPage;
