
import { FileSignature, Share2, UserCheck, BadgePercent } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const icons = { FileSignature, Share2, UserCheck, BadgePercent };
const iconKeys: (keyof typeof icons)[] = ['FileSignature', 'Share2', 'UserCheck', 'BadgePercent'];

const HowItWorks = () => {
  const { t } = useTranslation('partnership');
  const steps = t('howItWorks.steps', { returnObjects: true }) as { title: string; description: string }[];
  
  return (
    <section className="py-12 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{t('howItWorks.title')}</h2>
        <div className="relative">
          <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-border -translate-y-1/2"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {Array.isArray(steps) && steps.map((step, index) => {
              const IconComponent = icons[iconKeys[index]];
              return (
                <div key={index} className="flex flex-col items-center text-center p-4 z-10">
                  <div className="bg-primary text-primary-foreground rounded-full h-16 w-16 flex items-center justify-center mb-4">
                    <IconComponent className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
