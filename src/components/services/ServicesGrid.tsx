import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  GraduationCap, FileText, Plane, Home, CreditCard, Users, Calculator, HelpCircle, Brain
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';

const iconList = [GraduationCap, FileText, Plane, Home, CreditCard, Users, Calculator, Brain, HelpCircle];
const routeList = ['/contact', '/contact', '/contact', '/contact', '/contact', '/contact', '/resources', '/quiz', '/contact'];

const ServicesGrid = () => {
  const { t } = useTranslation('services');
  const navigate = useNavigate();
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const services = (t('servicesGrid.services', { returnObjects: true }) as any[]).map((s: any, i: number) => ({
    ...s, icon: iconList[i], action: () => navigate(routeList[i])
  }));

  return (
    <section className="py-12 sm:py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{t('servicesGrid.sectionTitle')}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t('servicesGrid.sectionSubtitle')}</p>
        </div>
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {services.map((service: any, index: number) => (
            <Card key={index} className={`group hover:shadow-xl hover:-translate-y-1 hover:border-accent/30 ${inView ? 'opacity-0 animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' }}>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
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
                <Button onClick={service.action} className="w-full bg-primary hover:bg-primary/90">{t('servicesGrid.startNow')}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesGrid;
