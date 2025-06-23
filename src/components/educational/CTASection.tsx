
import React from 'react';
import { Button } from '@/components/ui/button';

const CTASection = () => {
  return (
    <section className="py-12 md:py-16 bg-orange-500 text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-4 md:mb-6">
          هل تحتاج مساعدة في اختيار التخصص؟
        </h2>
        <p className="text-sm md:text-base lg:text-lg mb-6 md:mb-8 max-w-2xl mx-auto opacity-90 leading-relaxed">
          احجز استشارة مجانية مع خبرائنا التعليميين لمساعدتك في اختيار التخصص المناسب لميولك وقدراتك
        </p>
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
          <Button size="lg" className="bg-white text-orange-500 hover:bg-gray-100 px-6 md:px-8 text-sm md:text-base">
            احجز استشارة مجانية
          </Button>
          <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-6 md:px-8 text-sm md:text-base">
            اختبار التخصص
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
