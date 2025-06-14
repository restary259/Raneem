
import React from 'react';
import { Star } from 'lucide-react';

const TestimonialSection = () => (
  <section className="py-12 md:py-24 bg-secondary">
    <div className="container mx-auto px-4">
      <div className="max-w-3xl mx-auto text-center">
        <div className="flex justify-center mb-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-6 w-6 text-yellow-400 fill-yellow-400" />
          ))}
        </div>
        <blockquote className="text-xl md:text-2xl font-cairo italic text-primary">
          “بفضل فريق درب، حصلت على قبول في جامعة ميونيخ خلال أقل من شهر. كانت تجربتي معهم ممتازة من البداية إلى النهاية.”
        </blockquote>
        <p className="mt-4 font-semibold text-lg text-muted-foreground">- أحمد، الأردن</p>
      </div>
    </div>
  </section>
);

export default TestimonialSection;
