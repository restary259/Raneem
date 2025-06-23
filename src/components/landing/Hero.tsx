
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const Hero = () => {
  const { t } = useTranslation('landing');

  return (
    <section className="relative min-h-screen flex items-center bg-gradient-to-br from-orange-50 to-yellow-50 overflow-hidden" dir="rtl">
      <div className="container mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="space-y-8 text-right">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                درب للدراسة الدولية
              </h1>
              <p className="text-xl md:text-2xl text-gray-700 leading-relaxed">
                {t('hero.subtitle')}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/contact">
                <Button 
                  size="lg" 
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto"
                >
                  {t('hero.consultation')}
                </Button>
              </Link>
              <Link to="/educational-programs">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white px-8 py-4 text-lg rounded-full transition-all duration-300 w-full sm:w-auto"
                >
                  تصفح البرامج
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center gap-6 pt-8 border-t border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">47+</div>
                <div className="text-sm text-gray-600">طالب تم قبولهم</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">16+</div>
                <div className="text-sm text-gray-600">شريك جامعي</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">95%</div>
                <div className="text-sm text-gray-600">نسبة نجاح</div>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative">
            <div className="relative z-10">
              <img
                src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png"
                alt="درب للدراسة الدولية - شعار الشركة"
                className="w-full max-w-md mx-auto h-auto object-contain"
                loading="eager"
              />
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-orange-200 rounded-full opacity-50 animate-pulse"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-yellow-200 rounded-full opacity-50 animate-pulse delay-1000"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
