
import React from 'react';
import { useTranslation } from 'react-i18next';
import PageHero from '@/components/common/PageHero';

const HeroSection = () => {
  const { t } = useTranslation('common');
  return (
    <PageHero
      variant="light"
      title={t('educational.heroTitle')}
      subtitle={t('educational.heroSubtitle')}
      badge={t('educational.heroBadge')}
    />
  );
};

export default HeroSection;
