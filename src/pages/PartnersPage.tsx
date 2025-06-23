
import React from 'react';
import { useTranslation } from 'react-i18next';
import Footer from '@/components/landing/Footer';
import EnhancedPartnersPage from '@/components/partners/EnhancedPartnersPage';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, GraduationCap, Award } from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";

const PartnersPage = () => {
  const { t } = useTranslation('partners');
  const isMobile = useIsMobile();

  const stats = [
    {
      icon: Users,
      number: '16+',
      label: 'شريك موثوق',
      description: 'جامعات ومؤسسات تعليمية'
    },
    {
      icon: MapPin,
      number: '5+',
      label: 'دولة',
      description: 'في جميع أنحاء العالم'
    },
    {
      icon: GraduationCap,
      number: '47+',
      label: 'طالب',
      description: 'تم قبولهم بنجاح'
    },
    {
      icon: Award,
      number: '10+',
      label: 'سنوات خبرة',
      description: 'في التعليم الدولي'
    }
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header is handled by MobileLayout */}

      {/* Hero Section */}
      <section className="py-8 sm:py-12 md:py-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4">
              شركاؤنا حول العالم
            </Badge>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              {t('partnersPage.heroTitle')}
            </h1>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-8 sm:py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="text-center">
                <CardContent className="p-4 sm:p-6">
                  <stat.icon className="h-8 w-8 sm:h-10 sm:w-10 text-primary mx-auto mb-2 sm:mb-4" />
                  <div className="text-2xl sm:text-3xl font-bold text-primary mb-1 sm:mb-2">
                    {stat.number}
                  </div>
                  <div className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">
                    {stat.label}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    {stat.description}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced Partners List */}
      <section className="py-8 sm:py-12 md:py-20">
        <div className="container mx-auto px-4">
          <EnhancedPartnersPage />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 sm:py-12 md:py-20 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
            هل تريد أن تصبح شريكاً معنا؟
          </h2>
          <p className="text-lg sm:text-xl mb-6 sm:mb-8 max-w-2xl mx-auto opacity-90">
            انضم إلى شبكة شركائنا المتنامية وساعد في تحقيق أحلام الطلاب التعليمية
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/partnership"
              className="bg-white text-primary px-6 sm:px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              سجل كشريك
            </a>
            <a
              href="/contact"
              className="border border-white text-white px-6 sm:px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              اتصل بنا
            </a>
          </div>
        </div>
      </section>

      {!isMobile && <Footer />}
    </div>
  );
};

export default PartnersPage;
