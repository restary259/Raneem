
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { icons } from "lucide-react";

type Step = {
  icon: keyof typeof icons;
  title: string;
  description: string;
};

const NewHowItWorks = () => {
  const { t } = useTranslation('partnership');
  const steps = t('howItWorks.steps', { returnObjects: true }) as Step[];

  const renderIcon = (iconName: keyof typeof icons) => {
    const IconComponent = icons[iconName];
    if (!IconComponent) return null;
    return <IconComponent className="h-12 w-12 text-primary" />;
  };

  return (
    <section className="py-12 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{t('howItWorks.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {Array.isArray(steps) && steps.map((step, index) => (
            <Card key={index} className="border-0 shadow-none">
              <CardContent className="p-6 flex flex-col items-center gap-4">
                <div className="p-4 bg-primary/10 rounded-full">
                    {renderIcon(step.icon)}
                </div>
                <h3 className="text-xl font-bold">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewHowItWorks;
