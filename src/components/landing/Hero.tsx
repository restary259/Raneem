
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const Hero = () => {
  const { t } = useTranslation('landing');

  return (
    <section className="relative min-h-screen flex flex-col justify-center items-center text-white" dir="rtl">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=80" 
          alt="Students studying" 
          className="w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 relative z-10 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Main Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
            رفيقك الدراسي العالمي
          </h1>
          
          {/* Subtitle */}
          <p className="text-lg md:text-xl lg:text-2xl text-white/90 leading-relaxed max-w-3xl mx-auto">
            من أول قرار حتى أول إنجاز.. درب هي الجسر الآمن نحو دراستك في الخارج
          </p>
          
          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/contact">
              <Button 
                size="lg" 
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto"
              >
                {t('hero.consultation')}
              </Button>
            </Link>
            <Link to="/educational-programs">
              <Button 
                variant="outline" 
                size="lg"
                className="border-2 border-white text-white hover:bg-white hover:text-gray-900 px-8 py-4 text-lg rounded-lg transition-all duration-300 w-full sm:w-auto"
              >
                {t('applyNow')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="absolute bottom-20 left-0 right-0 z-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 gap-8 max-w-4xl mx-auto text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-orange-400">+47</div>
              <div className="text-sm md:text-base text-white/80 mt-2">طالب راض</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-orange-400">+16</div>
              <div className="text-sm md:text-base text-white/80 mt-2">شريك تعليمي</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-orange-400">+5</div>
              <div className="text-sm md:text-base text-white/80 mt-2">دولة حول العالم</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section Title */}
      <div className="absolute bottom-8 left-0 right-0 z-10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl md:text-2xl font-semibold text-white/90">
            أفضل الجامعات العالمية
          </h2>
        </div>
      </div>
    </section>
  );
};

export default Hero;
