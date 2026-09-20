import React from 'react';
import { useTranslation } from 'react-i18next';
import DarbPageHero from '@/components/common/DarbPageHero';
import { DARB_PUBLIC_HERO_IMAGES } from '@/config/publicHeroImages';

const HeroSection = () => {
  const { t } = useTranslation('common');
  return (
    <DarbPageHero
      eyebrow={t('educational.heroBadge')}
      imageUrl={DARB_PUBLIC_HERO_IMAGES.programs}
      imageAlt={t('educational.imageAlt', 'Students on a university campus in Germany')}
      title={t('educational.heroTitle')}
      subtitle={t('educational.heroSubtitle')}
    />
  );
};

export default HeroSection;
