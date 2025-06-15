
import { CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

const WhyChooseUs = () => {
  const { t } = useTranslation();
  const reasons: string[] = t('whyChooseUs.reasons', { returnObjects: true });

  return (
    <section id="why-us" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">{t('whyChooseUs.title')}</h2>
        </div>
        <div className="mt-12 max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {reasons.map((reason, index) => (
            <div key={index} className="flex items-center space-x-3 flex-row-reverse space-x-reverse">
              <CheckCircle 
                className="h-6 w-6 text-primary flex-shrink-0 opacity-0 animate-scale-in"
                style={{ animationDelay: `${index * 150}ms` }}
              />
              <p className="text-lg">{reason}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
