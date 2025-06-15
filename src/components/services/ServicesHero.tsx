
import React from 'react';
import { useTranslation } from 'react-i18next';

const ServicesHero = () => {
  const { t } = useTranslation('services');
  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-primary to-background text-center animate-fade-in">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground">
          {t('servicesHero.title')}
        </h1>
        <p className="mt-6 max-w-3xl mx-auto text-lg md:text-xl text-primary-foreground/80">
          {t('servicesHero.subtitle')}
        </p>
      </div>
    </section>
  );
};

export default ServicesHero;
