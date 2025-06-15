
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

const Testimonials = () => {
  const { t } = useTranslation();
  const testimonials = t('testimonials.items', { returnObjects: true }) as { quote: string; name: string; location: string; avatar: string; }[];
  
  return (
    <section id="testimonials" className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">{t('testimonials.title')}</h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="text-right">
              <CardContent className="pt-6">
                <div className="flex justify-end mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground italic">“{testimonial.quote}”</p>
                <div className="mt-4 flex items-center flex-row-reverse">
                  <img src={testimonial.avatar} alt={testimonial.name} className="h-12 w-12 rounded-full ml-4" />
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
