
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { icons } from "lucide-react";
import { useInView } from "react-intersection-observer";

type Pillar = {
  icon: keyof typeof icons;
  title: string;
  description: string;
};

const TrustSection = () => {
  const { t } = useTranslation('partnership');
  const pillars = t('trustSection.pillars', { returnObjects: true }) as Pillar[];
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const renderIcon = (iconName: keyof typeof icons) => {
    const IconComponent = icons[iconName];
    if (!IconComponent) return null;
    return <IconComponent className="h-8 w-8 text-primary" />;
  };

  return (
    <section className="py-12 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{t('trustSection.title')}</h2>
        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {Array.isArray(pillars) && pillars.map((pillar, index) => (
            <Card 
              key={index} 
              className={`border border-border shadow-sm text-center hover:shadow-lg hover:-translate-y-1 ${inView ? 'opacity-0 animate-fade-in-up' : 'opacity-0'}`}
              style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-full">
                  {renderIcon(pillar.icon)}
                </div>
                <h3 className="text-lg font-bold text-foreground">{pillar.title}</h3>
                <p className="text-sm text-muted-foreground">{pillar.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
