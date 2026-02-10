
import { useTranslation } from "react-i18next";
import { icons } from "lucide-react";
import { useInView } from "react-intersection-observer";

type Step = {
  icon: keyof typeof icons;
  title: string;
  description: string;
};

const TimelineStep = ({ step, index, total }: { step: Step; index: number; total: number }) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });
  const isEven = index % 2 === 0;

  const renderIcon = (iconName: keyof typeof icons) => {
    const IconComponent = icons[iconName];
    if (!IconComponent) return null;
    return <IconComponent className="h-6 w-6 text-primary-foreground" />;
  };

  return (
    <div ref={ref} className={`relative flex items-start gap-4 md:gap-8 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      {/* Desktop: alternating layout */}
      <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:gap-8 w-full items-start">
        {/* Right side content (RTL: appears on the right) */}
        <div className={`${isEven ? '' : 'invisible'}`}>
          {isEven && (
             <div className="bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-md hover:border-accent/20 transition-all duration-300">
              <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
            </div>
          )}
        </div>

        {/* Center: circle + line */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center z-10 shadow-md hover:scale-110 transition-transform duration-300">
            {renderIcon(step.icon)}
          </div>
          {index < total - 1 && (
            <div className="w-0.5 h-20 bg-border mt-2" />
          )}
        </div>

        {/* Left side content (RTL: appears on the left) */}
        <div className={`${!isEven ? '' : 'invisible'}`}>
          {!isEven && (
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-md hover:border-accent/20 transition-all duration-300">
              <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: stacked layout */}
      <div className="flex md:hidden gap-4 w-full">
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center z-10 shadow-md">
            {renderIcon(step.icon)}
          </div>
          {index < total - 1 && (
            <div className="w-0.5 flex-1 bg-border mt-2" />
          )}
        </div>
        <div className="bg-card rounded-xl p-4 shadow-sm border border-border flex-1 mb-4 hover:shadow-md hover:border-accent/20 transition-all duration-300">
          <h3 className="text-base font-bold text-foreground mb-1">{step.title}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
        </div>
      </div>
    </div>
  );
};

const NewHowItWorks = () => {
  const { t } = useTranslation('partnership');
  const steps = t('howItWorks.steps', { returnObjects: true }) as Step[];

  return (
    <section className="py-12 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">{t('howItWorks.title')}</h2>
        <div className="max-w-4xl mx-auto">
          {Array.isArray(steps) && steps.map((step, index) => (
            <TimelineStep key={index} step={step} index={index} total={steps.length} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewHowItWorks;
