
import { Card, CardContent } from "@/components/ui/card";
import { Quote } from 'lucide-react';
import { useTranslation } from "react-i18next";

const SuccessStories = () => {
  const { t } = useTranslation('partnership');
  const testimonials = t('partnershipSuccessStories.items', { returnObjects: true }) as { quote: string; name: string; from: string; }[];
  
  return (
    <section className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{t('partnershipSuccessStories.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {Array.isArray(testimonials) && testimonials.map((testimonial, index) => (
            <Card key={index} className="bg-background/70">
              <CardContent className="p-6">
                <Quote className="h-8 w-8 text-accent mb-4" />
                <blockquote className="text-lg text-primary italic">"{testimonial.quote}"</blockquote>
                <p className="mt-4 font-bold text-right">- {testimonial.name}، {testimonial.from}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SuccessStories;
