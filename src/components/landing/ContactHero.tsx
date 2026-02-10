
import React from 'react';
import { useTranslation } from 'react-i18next';

const ContactHero = () => {
  const { t } = useTranslation('contact');
  return (
    <section className="py-12 sm:py-20 md:py-32 bg-gradient-to-b from-primary/90 to-background text-center animate-fade-in" dir="rtl">
      <div className="container mx-auto px-4">
        <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold text-primary-foreground">
          {t('contactHero.title')}
        </h1>
        <p className="mt-6 max-w-3xl mx-auto text-lg md:text-xl text-primary-foreground/80">
          {t('contactHero.subtitle')}
        </p>
      </div>
    </section>
  );
};

export default ContactHero;
