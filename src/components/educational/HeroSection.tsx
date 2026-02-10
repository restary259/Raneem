
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

const HeroSection = () => {
  const { t } = useTranslation('common');
  return (
    <section className="py-8 md:py-12 bg-gradient-to-b from-orange-50 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-orange-800 text-xs md:text-sm">
            {t('educational.heroBadge')}
          </Badge>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">{t('educational.heroTitle')}</h1>
          <p className="text-sm md:text-base lg:text-lg text-muted-foreground mb-6 max-w-2xl mx-auto leading-relaxed">
            {t('educational.heroSubtitle')}
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
