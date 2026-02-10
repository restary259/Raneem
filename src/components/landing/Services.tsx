
import { FileText, BookOpen, Book, MapPin, Check, Users, Youtube } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useInView } from "react-intersection-observer";
import { useTranslation } from "react-i18next";

const serviceIcons = [FileText, BookOpen, Book, MapPin, Check, Users, Youtube];

const Services = () => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { t } = useTranslation();
  const items = t('services_landing.items', { returnObjects: true }) as string[];

  return (
    <section id="services" className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">{t('nav.services')}</h2>
        </div>
        <div ref={ref} className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {items.map((title, index) => {
            const Icon = serviceIcons[index] || FileText;
            return (
              <Card 
                key={index} 
                className={`text-center hover:shadow-xl hover:-translate-y-1 hover:border-accent/30 ${inView ? 'opacity-0 animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
              >
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <Icon className="h-12 w-12 text-primary" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Services;
