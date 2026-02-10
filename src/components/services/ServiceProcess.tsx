
import React from 'react';
import { Search, FileSignature, Plane, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const stepIcons = [Search, FileSignature, Plane, CheckCircle];

interface ServiceProcessProps {
  title?: string;
  description?: string;
  className?: string;
}

const ServiceProcess: React.FC<ServiceProcessProps> = ({ title, description, className }) => {
  const { t } = useTranslation('services');
  const displayTitle = title || t('serviceProcess.title');
  const displayDesc = description || t('serviceProcess.description');
  const steps = t('serviceProcess.steps', { returnObjects: true }) as any[];

  return (
    <section className={cn("py-12 md:py-24", className)}>
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-cairo text-primary">{displayTitle}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{displayDesc}</p>
        </div>
        <div className="relative max-w-5xl mx-auto">
          <div className="hidden md:block absolute top-8 left-0 w-full h-0.5 bg-border -translate-y-1/2"></div>
          <div className="grid gap-12 md:gap-8 md:grid-cols-4">
            {Array.isArray(steps) && steps.map((step: any, index: number) => {
              const Icon = stepIcons[index] || CheckCircle;
              return (
                <div key={index} className="text-center relative bg-background px-4">
                  <div className="flex justify-center mb-4">
                    <div className="rounded-full bg-accent text-accent-foreground p-4 ring-8 ring-background">
                      <Icon className="h-8 w-8" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold font-cairo text-primary">{step.title}</h3>
                  <p className="mt-2 text-muted-foreground">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServiceProcess;
