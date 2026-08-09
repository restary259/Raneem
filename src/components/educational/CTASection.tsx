import React from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

/**
 * Full-bleed CTA. The brand orange is used as an accent band rather than a
 * flat wash so both button labels keep AA contrast against their surface.
 */
const CTASection = () => {
  const { t } = useTranslation('common');
  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-brand/10 to-background border-y border-brand/20">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-4 md:mb-6 text-foreground">
          {t('educational.ctaTitle')}
        </h2>
        <p className="text-sm md:text-base lg:text-lg mb-6 md:mb-8 max-w-2xl mx-auto text-muted-foreground leading-relaxed">
          {t('educational.ctaSubtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
          <Button
            size="lg"
            className="min-h-[48px] px-6 md:px-8 text-sm md:text-base bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            asChild
          >
            <Link to="/apply">{t('educational.ctaButton1')}</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="min-h-[48px] px-6 md:px-8 text-sm md:text-base bg-background text-foreground border-2 border-brand hover:bg-brand-strong/10 active:bg-brand-strong/20 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            asChild
          >
            <Link to="/quiz">{t('educational.ctaButton2')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
