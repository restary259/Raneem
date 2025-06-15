
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { HeartHandshake, Zap, Users, Globe, ShieldCheck, PackageCheck } from "lucide-react";

const icons = [HeartHandshake, Zap, Users, Globe, ShieldCheck, PackageCheck];

const WhyChooseUs = () => {
  const { t } = useTranslation();
  const reasonsList = t('whyChooseUs.reasons', { returnObjects: true });
  const reasons: { title: string; description: string }[] = Array.isArray(reasonsList) ? reasonsList : [];

  return (
    <section id="why-us" className="py-12 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">{t('whyChooseUs.title')}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t('whyChooseUs.subtitle', "نحن لا نعد بالنجاح فحسب، بل نصنعه معك. إليك كيف نضمن لك تجربة استثنائية.")}</p>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {reasons.map((reason, index) => {
            const Icon = icons[index % icons.length];
            return (
              <Card 
                key={index} 
                className="text-center p-6 bg-secondary border-transparent hover:shadow-xl hover:-translate-y-2 transition-all duration-300 opacity-0 animate-fade-in"
                style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'forwards' }}
              >
                <CardHeader className="items-center p-2">
                  <div className="p-4 bg-primary/10 rounded-full mb-4">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-semibold">{reason.title}</CardTitle>
                </CardHeader>
                <CardDescription>{reason.description}</CardDescription>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
