import React from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import LebenslaufBuilder from '@/components/lebenslauf/LebenslaufBuilder';
import SEOHead from '@/components/common/SEOHead';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

const LebenslaufBuilderPage = () => {
  const { t } = useTranslation('resources');
  const { dir } = useDirection();

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <SEOHead title={t('lebenslaufBuilder.title')} description={t('lebenslaufBuilder.description')} />
      <Header />
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t('lebenslaufBuilder.title')}</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">{t('lebenslaufBuilder.description')}</p>
          </div>
          <LebenslaufBuilder />
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default LebenslaufBuilderPage;
