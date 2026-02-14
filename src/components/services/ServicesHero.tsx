
import React from 'react';
import { useTranslation } from 'react-i18next';
import PageHero from '@/components/common/PageHero';

const ServicesHero = () => {
  const { t } = useTranslation('services');
  return (
    <PageHero
      variant="gradient"
      title={t('servicesHero.title')}
      subtitle={t('servicesHero.subtitle')}
    />
  );
};

export default ServicesHero;
