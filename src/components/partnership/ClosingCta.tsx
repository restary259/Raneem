
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const ClosingCta = () => {
  const { t } = useTranslation('partnership');
  return (
    <section className="py-20 md:py-32 bg-gray-900 text-primary-foreground">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold whitespace-pre-line">{t('closingCta.title')}</h2>
        <div className="mt-8">
          <Button size="lg" variant="accent" asChild>
            <a href="#register">{t('closingCta.button')}</a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ClosingCta;
