import React from 'react';
import { useTranslation } from 'react-i18next';
import DarbPageHero from '@/components/common/DarbPageHero';
import germanyHero from '@/assets/germany-home-hero.jpg';

const ServicesHero = () => {
  const { t } = useTranslation('services');
  return (
    <DarbPageHero
      eyebrow={t('servicesHero.eyebrow', 'SERVICES')}
      imageUrl={germanyHero}
      imageAlt={t('servicesHero.imageAlt', 'Student preparing documents for studying in Germany')}
      title={t('servicesHero.title')}
      subtitle={t('servicesHero.subtitle')}
    />
  );
};

export default ServicesHero;
