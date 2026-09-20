
import React from 'react';
import { useTranslation } from 'react-i18next';
import contactHero from '@/assets/contact-germany-hero.jpg';

const ContactHero = () => {
  const { t } = useTranslation('contact');
  return (
    <section className="relative min-h-[390px] overflow-hidden bg-primary text-primary-foreground md:min-h-[560px]">
      <img src={contactHero} alt={t('contactHero.imageAlt')} width={1920} height={900} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-primary/15" />
      <div className="container relative flex min-h-[390px] items-center justify-center px-4 pb-16 pt-28 md:min-h-[560px] md:pb-20 md:pt-40">
        <div className="w-full max-w-3xl bg-primary/70 px-6 py-10 text-center shadow-surface-lg backdrop-blur-[2px] md:px-14 md:py-14">
          <h1 className="text-5xl font-bold leading-tight md:text-7xl">{t('contactHero.title')}</h1>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 grid h-3 grid-cols-7" aria-hidden="true">
        <span className="bg-destructive" /><span className="bg-brand" /><span className="bg-accent" /><span className="bg-primary" /><span className="bg-trust" /><span className="bg-secondary" /><span className="bg-brand" />
      </div>
    </section>
  );
};

export default ContactHero;
