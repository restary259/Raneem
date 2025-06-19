
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: "أحمد محمد",
    country: "ألمانيا",
    university: "TU Munich",
    text: "بفضل درب تمكنت من الحصول على قبول في جامعة ميونخ التقنية. الفريق كان متعاوناً جداً ووفر لي كل الدعم المطلوب.",
    rating: 5,
    image: "/lovable-uploads/placeholder.svg"
  },
  {
    name: "فاطمة العلي",
    country: "رومانيا",
    university: "Carol Davila University",
    text: "رحلتي للدراسة في كلية الطب كانت سهلة ومريحة بفضل الخدمات المتميزة التي قدمتها درب.",
    rating: 5,
    image: "/lovable-uploads/placeholder.svg"
  },
  {
    name: "يوسف الحسن",
    country: "ألمانيا",
    university: "RWTH Aachen",
    text: "من أفضل القرارات التي اتخذتها هو التعامل مع درب. ساعدوني في كل خطوة من الحصول على القبول حتى الوصول.",
    rating: 5,
    image: "/lovable-uploads/placeholder.svg"
  }
];

const TestimonialSection = () => {
  return (
    <section className="py-12 md:py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">آراء طلابنا</h2>
          <p className="text-gray-600">
            اكتشف تجارب طلابنا الناجحة في رحلتهم للدراسة في الخارج
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  <Quote className="h-8 w-8 text-primary opacity-20 mr-2" />
                  <div className="flex">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                </div>
                
                <p className="text-gray-700 mb-6 leading-relaxed text-right">
                  "{testimonial.text}"
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="text-right">
                    <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                    <p className="text-sm text-gray-600">{testimonial.university}</p>
                    <p className="text-xs text-primary">{testimonial.country}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-semibold">
                      {testimonial.name.charAt(0)}
                    </span>
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

export default TestimonialSection;
