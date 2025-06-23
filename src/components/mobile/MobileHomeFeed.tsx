
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import HomeFeed from '@/components/feed/HomeFeed';
import MobileCard from './MobileCard';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Badge } from '@/components/ui/badge';
import { Bell, Star, MapPin, Users } from 'lucide-react';

const MobileHomeFeed: React.FC = () => {
  const { user } = useAuth();

  if (user) {
    return <HomeFeed />;
  }

  // Guest/non-authenticated mobile home experience
  const featuredUniversities = [
    {
      id: '1',
      title: 'جامعة هارفارد',
      description: 'إحدى أفضل الجامعات في العالم مع برامج متميزة في جميع التخصصات',
      imageUrl: '/lovable-uploads/fc80f423-4215-4afe-ab5f-60a784436ae5.png',
      location: 'بوسطن، أمريكا',
      badges: [
        { text: 'منحة متاحة', variant: 'destructive' as const },
        { text: 'قبول شتوي', variant: 'secondary' as const }
      ]
    },
    {
      id: '2',
      title: 'جامعة أكسفورد',
      description: 'جامعة عريقة بتاريخ يمتد لأكثر من 900 عام مع تفوق أكاديمي',
      imageUrl: '/lovable-uploads/b88bf7f9-2a94-4112-8c34-6b83771686e7.png',
      location: 'أكسفورد، بريطانيا',
      badges: [
        { text: 'مميزة', variant: 'default' as const },
        { text: 'قبول صيفي', variant: 'outline' as const }
      ]
    }
  ];

  const quickActions = [
    {
      title: 'تصفح التخصصات',
      description: 'اكتشف البرامج التعليمية المتاحة',
      icon: '🎓',
      href: '/educational-programs'
    },
    {
      title: 'اختبار التخصص',
      description: 'اكتشف التخصص المناسب لك',
      icon: '📊',
      href: '/quiz'
    },
    {
      title: 'تحدث معنا',
      description: 'احصل على استشارة مجانية',
      icon: '💬',
      href: '/contact'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-orange-500 to-yellow-500 px-4 py-8 text-white">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-2">
            مرحباً بك في درب
          </h1>
          <p className="text-orange-100 mb-6">
            رفيقك الدراسي العالمي - من أول قرار حتى أول إنجاز
          </p>
          <Button
            variant="secondary"
            size="lg"
            className="w-full bg-white text-orange-600 hover:bg-orange-50"
            onClick={() => window.location.href = '/student-auth'}
          >
            ابدأ رحلتك التعليمية
          </Button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-8">
        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            إجراءات سريعة
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {quickActions.map((action) => (
              <div
                key={action.title}
                className="bg-white rounded-lg p-4 border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => window.location.href = action.href}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{action.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-medium">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Universities */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              جامعات مميزة
            </h2>
            <Button variant="ghost" size="sm">
              عرض الكل
            </Button>
          </div>
          
          <Carousel className="w-full">
            <CarouselContent className="-mr-2">
              {featuredUniversities.map((university) => (
                <CarouselItem key={university.id} className="pr-2 basis-[280px]">
                  <MobileCard
                    title={university.title}
                    description={university.description}
                    imageUrl={university.imageUrl}
                    location={university.location}
                    badges={university.badges}
                    ctaText="عرض البرامج"
                    onViewDetails={() => window.location.href = '/educational-programs'}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </section>

        {/* Statistics */}
        <section className="bg-white rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-green-500" />
            إحصائياتنا
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">500+</div>
              <div className="text-sm text-muted-foreground">جامعة شريكة</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">10,000+</div>
              <div className="text-sm text-muted-foreground">طالب مقبول</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">50+</div>
              <div className="text-sm text-muted-foreground">دولة</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">95%</div>
              <div className="text-sm text-muted-foreground">نسبة النجاح</div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white text-center">
          <h2 className="text-lg font-semibold mb-2">
            جاهز لبدء رحلتك؟
          </h2>
          <p className="text-blue-100 mb-4 text-sm">
            انضم إلى آلاف الطلاب الذين حققوا أحلامهم
          </p>
          <Button
            variant="secondary"
            className="w-full bg-white text-blue-600 hover:bg-gray-100"
            onClick={() => window.location.href = '/student-auth'}
          >
            سجل الآن مجاناً
          </Button>
        </section>
      </div>
    </div>
  );
};

export default MobileHomeFeed;
