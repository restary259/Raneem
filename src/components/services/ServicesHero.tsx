import { useTranslation } from 'react-i18next';
import DarbPageHero from '@/components/common/DarbPageHero';
import { DARB_PUBLIC_HERO_IMAGES } from '@/config/publicHeroImages';

const ServicesHero = () => {
  const { t } = useTranslation(['services', 'common']);
  return (
    <DarbPageHero
      imageUrl={DARB_PUBLIC_HERO_IMAGES.services}
      imageAlt={t('servicesHero.imageAlt', 'Student preparing documents for studying in Germany')}
      title={t('common:pageHero.services.title', 'Our Services')}
      subtitle={t('servicesHero.subtitle')}
    />
  );
};

export default ServicesHero;
