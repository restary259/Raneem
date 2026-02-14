
import React from 'react';
import { useTranslation } from 'react-i18next';
import PageHero from '@/components/common/PageHero';

const ContactHero = () => {
  const { t } = useTranslation('contact');
  return (
    <PageHero
      variant="gradient"
      title={t('contactHero.title')}
      subtitle={t('contactHero.subtitle')}
    />
  );
};

export default ContactHero;
