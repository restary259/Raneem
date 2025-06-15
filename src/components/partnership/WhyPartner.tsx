
import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const WhyPartner = () => {
  const { t } = useTranslation();
  const benefits = t('whyPartner.benefits', { returnObjects: true }) as string[];

  return (
    <section className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{t('whyPartner.title')}</h2>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-start gap-4">
              <CheckCircle className="h-6 w-6 text-accent mt-1 flex-shrink-0" />
              <p className="text-lg text-primary">{benefit}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyPartner;
