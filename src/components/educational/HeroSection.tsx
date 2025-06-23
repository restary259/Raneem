
import React from 'react';
import { Badge } from '@/components/ui/badge';

const HeroSection = () => {
  return (
    <section className="py-8 md:py-12 bg-gradient-to-b from-orange-50 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-orange-800 text-xs md:text-sm">
            اكتشف تخصصك المثالي
          </Badge>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
            التخصصات الأكاديمية
          </h1>
          <p className="text-sm md:text-base lg:text-lg text-muted-foreground mb-6 max-w-2xl mx-auto leading-relaxed">
            استكشف مجموعة واسعة من التخصصات الأكاديمية واختر المسار المهني الذي يناسب طموحاتك
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
