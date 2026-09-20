import React from 'react';
import { useTranslation } from 'react-i18next';
import DarbPageHero from '@/components/common/DarbPageHero';
import { DARB_PUBLIC_HERO_IMAGES } from '@/config/publicHeroImages';

const ServicesHero = () => {
  const { t } = useTranslation('services');
  return (
    <DarbPageHero
      eyebrow={t('servicesHero.eyebrow', 'SERVICES')}
      imageUrl={DARB_PUBLIC_HERO_IMAGES.services}
      imageAlt={t('servicesHero.imageAlt', 'Student preparing documents for studying in Germany')}
      title={t('servicesHero.title')}
      subtitle={t('servicesHero.subtitle')}
    />
  );
};

export default ServicesHero;
