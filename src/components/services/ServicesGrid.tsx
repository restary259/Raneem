import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  GraduationCap, FileText, Plane, Home, CreditCard, Users, Calculator, HelpCircle, Brain
} from 'lucide-react';
import { useNavigate } from '@/lib/router-compat';
import { useInView } from 'react-intersection-observer';
import type { LucideIcon } from 'lucide-react';

interface ServiceCopy {
  title: string;
  description: string;
  features: string[];
}

interface ServiceItem extends ServiceCopy {
  icon: LucideIcon;
  route: string;
}

const iconList = [GraduationCap, FileText, Plane, Home, CreditCard, Users, Calculator, Brain, HelpCircle];
const routeList = ['/contact', '/contact', '/contact', '/contact', '/contact', '/contact', '/resources', '/quiz', '/contact'];

const ServicesGrid = () => {
  const { t } = useTranslation('services');
  const navigate = useNavigate();
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const copy = t('servicesGrid.services', { returnObjects: true });
  const services: ServiceItem[] = (Array.isArray(copy) ? copy : []).map((service, index) => ({
    ...(service as ServiceCopy),
    icon: iconList[index] ?? HelpCircle,
    route: routeList[index] ?? '/contact',
  }));

  return (
    <section className="py-12 sm:py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{t('servicesGrid.sectionTitle')}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t('servicesGrid.sectionSubtitle')}</p>
        </div>
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {services.map((service, index) => (
            <Card key={service.title} className={`group border-border bg-background transition-[transform,box-shadow,border-color] hover:-translate-y-1 hover:border-brand/35 hover:shadow-surface-lg motion-reduce:transform-none ${inView ? 'opacity-0 animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' }}>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/15 motion-reduce:transform-none sm:h-16 sm:w-16">
                  <service.icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-2">{service.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-4 text-sm">{service.description}</p>
                <ul className="space-y-2 mb-6">
                  {service.features.map((feature: string, fi: number) => (
                    <li key={fi} className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button onClick={() => navigate(service.route)} className="w-full">{t('servicesGrid.startNow')}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesGrid;
