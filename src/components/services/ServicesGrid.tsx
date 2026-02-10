import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  GraduationCap, 
  FileText, 
  Plane, 
  Home, 
  CreditCard, 
  Users,
  Calculator,
  HelpCircle,
  Brain
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';

const ServicesGrid = () => {
  const { t } = useTranslation(['services', 'common']);
  const navigate = useNavigate();

  const services = [
    {
      icon: GraduationCap,
      title: "استشارة أكاديمية",
      description: "استشارة شخصية لاختيار التخصص والجامعة المناسبة",
      features: ["تقييم شخصي للطالب", "اختيار التخصص المناسب", "ترشيح أفضل الجامعات"],
      action: () => navigate('/contact')
    },
    {
      icon: FileText,
      title: "إعداد الوثائق",
      description: "تجهيز وترجمة جميع الوثائق المطلوبة للتقديم",
      features: ["ترجمة معتمدة", "تدقيق الوثائق", "تنسيق حسب متطلبات الجامعة"],
      action: () => navigate('/contact')
    },
    {
      icon: Plane,
      title: "استخراج التأشيرة",
      description: "مساعدة كاملة في إجراءات التأشيرة الدراسية",
      features: ["تحضير الملف", "حجز موعد السفارة", "مراجعة الطلب"],
      action: () => navigate('/contact')
    },
    {
      icon: Home,
      title: "البحث عن سكن",
      description: "مساعدة في العثور على سكن مناسب قريب من الجامعة",
      features: ["بحث حسب الميزانية", "التواصل مع الملاك", "مراجعة العقد"],
      action: () => navigate('/contact')
    },
    {
      icon: CreditCard,
      title: "الخدمات المصرفية",
      description: "مساعدة في فتح حساب بنكي وإجراءات مالية",
      features: ["فتح حساب بنكي", "بطاقة ائتمان", "تحويلات مالية"],
      action: () => navigate('/contact')
    },
    {
      icon: Users,
      title: "الدعم بعد الوصول",
      description: "مساعدة مستمرة بعد الوصول للبلد الجديد",
      features: ["دعم هاتفي", "حل المشاكل", "نصائح للتأقلم"],
      action: () => navigate('/contact')
    },
    {
      icon: Calculator,
      title: "حاسبة التكاليف",
      description: "احسب تكلفة الدراسة والمعيشة بدقة",
      features: ["تكلفة الدراسة", "تكلفة المعيشة", "مقارنة بين الدول"],
      action: () => navigate('/resources')
    },
    {
      icon: Brain,
      title: "اختبار مطابقة التخصص",
      description: "اكتشف التخصص الجامعي الأنسب لك",
      features: ["اختبار شخصية", "تحليل الاهتمامات", "ترشيحات مخصصة"],
      action: () => navigate('/quiz')
    },
    {
      icon: HelpCircle,
      title: "استشارة مجانية",
      description: "احجز استشارة مجانية مع خبرائنا",
      features: ["30 دقيقة مجاناً", "خبراء متخصصون", "إجابات فورية"],
      action: () => navigate('/contact')
    }
  ];

  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-12 sm:py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            خدماتنا الشاملة
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            نقدم لك مجموعة متكاملة من الخدمات لضمان رحلة دراسية ناجحة
          </p>
        </div>

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {services.map((service, index) => (
            <Card 
              key={index} 
              className={`group hover:shadow-xl hover:-translate-y-1 hover:border-accent/30 ${inView ? 'opacity-0 animate-fade-in-up' : 'opacity-0'}`}
              style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' }}
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                  <service.icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-2">{service.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-4 text-sm">
                  {service.description}
                </p>
                <ul className="space-y-2 mb-6">
                  {service.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={service.action}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  ابدأ الآن
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesGrid;
