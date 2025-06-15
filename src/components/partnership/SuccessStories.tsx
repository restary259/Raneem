
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const SuccessStories = () => {
  const { t } = useTranslation('partnership');
  const testimonials = t('agentTestimonials.items', { returnObjects: true }) as { quote: string; name: string; location: string; image: string }[];
  
  return (
    <section className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{t('agentTestimonials.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {Array.isArray(testimonials) && testimonials.map((testimonial, index) => (
            <Card key={index} className="bg-background border-border/50 text-center">
              <CardContent className="p-8 flex flex-col items-center">
                <Avatar className="w-24 h-24 mb-6 border-4 border-accent">
                    <AvatarImage src={testimonial.image} alt={testimonial.name} />
                    <AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <blockquote className="text-lg italic text-foreground/90">"{testimonial.quote}"</blockquote>
                <div className="mt-6">
                    <p className="font-bold text-lg text-primary">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SuccessStories;
