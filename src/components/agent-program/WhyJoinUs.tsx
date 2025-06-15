
import { useTranslation } from "react-i18next";
import { icons } from "lucide-react";

type Benefit = {
  icon: keyof typeof icons;
  text: string;
};

const WhyJoinUs = () => {
  const { t } = useTranslation('partnership');
  const benefits = t('whyJoinUs.benefits', { returnObjects: true }) as Benefit[];

  const renderIcon = (iconName: keyof typeof icons) => {
    const LucideIcon = icons[iconName];

    if (LucideIcon) {
      return <LucideIcon className="h-10 w-10 text-accent" />;
    }
    
    const FallbackIcon = icons.UserPlus;
    return <FallbackIcon className="h-10 w-10 text-accent" />;
  };

  return (
    <section className="py-12 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{t('whyJoinUs.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.isArray(benefits) && benefits.map((benefit, index) => (
            <div key={index} className="flex items-start gap-6">
              <div className="flex-shrink-0">
                {renderIcon(benefit.icon)}
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-foreground">{benefit.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyJoinUs;
