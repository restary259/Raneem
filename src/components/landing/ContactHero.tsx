
import React from 'react';
import { useTranslation } from 'react-i18next';
import contactHero from '@/assets/contact-germany-hero.jpg';
import darbLogoAsset from '@/assets/darb-logo.png.asset.json';

const ContactHero = () => {
  const { t } = useTranslation('contact');
  return (
    <section className="relative min-h-[340px] overflow-hidden bg-primary text-primary-foreground md:min-h-[470px]">
      <img src={contactHero} alt={t('contactHero.imageAlt')} width={1920} height={900} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-primary/15" />
      <div className="container relative flex min-h-[340px] items-center justify-center px-4 py-16 md:min-h-[470px]">
        <div className="w-full max-w-3xl bg-primary/80 px-6 py-8 text-center shadow-surface-lg backdrop-blur-[2px] md:px-14 md:py-11">
          <img src={darbLogoAsset.url} alt="" aria-hidden="true" className="mx-auto mb-4 h-16 w-auto object-contain" />
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">{t('contactHero.title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-primary-foreground/90 md:text-lg">{t('contactHero.subtitle')}</p>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 grid h-3 grid-cols-7" aria-hidden="true">
        <span className="bg-destructive" /><span className="bg-brand" /><span className="bg-accent" /><span className="bg-primary" /><span className="bg-trust" /><span className="bg-secondary" /><span className="bg-brand" />
      </div>
    </section>
  );
};

export default ContactHero;
