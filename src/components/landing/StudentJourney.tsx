
import { Search, FileSignature, Plane, CheckCircle } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { useTranslation } from 'react-i18next';

const icons = [Search, FileSignature, Plane, CheckCircle];

const StepItem = ({ step, index }: { step: { title: string; description: string }; index: number }) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 });
  const Icon = icons[index];
  
  return (
    <div 
      ref={ref} 
      className={`flex flex-col items-center text-center relative px-4 ${inView ? 'opacity-0 animate-fade-in-up' : 'opacity-0'}`}
      style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'forwards' }}
    >
      <div className="hidden md:block absolute bg-primary/20 w-1 h-8 -top-8" />
      <div className="relative z-10 flex h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 items-center justify-center rounded-full bg-background border-4 border-primary/20 shadow-lg">
        <div className="flex h-[80%] w-[80%] items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 hover:scale-110">
          <Icon className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10" />
        </div>
      </div>
      <h3 className="mt-6 text-xl font-bold">{step.title}</h3>
      <p className="mt-2 text-muted-foreground">{step.description}</p>
    </div>
  );
};
  
const StudentJourney = () => {
  const { t } = useTranslation('landing');
  const steps = t('journey.steps', { returnObjects: true }) as { title: string; description: string }[];

  return (
    <section className="py-10 md:py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-primary">{t('journey.title')}</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t('journey.subtitle')}
          </p>
        </div>
        <div className="relative">
          <div className="hidden md:block absolute top-12 left-0 w-full h-1 bg-primary/20 rounded-full" />
          <div className="grid md:grid-cols-4 gap-y-12 md:gap-x-8">
            {steps.map((step, index) => (
              <StepItem key={index} step={step} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StudentJourney;
