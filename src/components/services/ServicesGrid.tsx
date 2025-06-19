
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

const ServicesGrid = () => {
  const { t } = useTranslation(['services', 'common']);
  const navigate = useNavigate();

  const services = [
    {
      icon: GraduationCap,
      title: "استشارة أكاديمية",
      description: "استشارة شخصية لاختيار التخصص والجامعة المناسبة",
      price: "مجاناً",
      features: ["تقييم شخصي للطالب", "اختيار التخصص المناسب", "ترشيح أفضل الجامعات"],
      action: () => navigate('/contact')
    },
    {
      icon: FileText,
      title: "إعداد الوثائق",
      description: "تجهيز وترجمة جميع الوثائق المطلوبة للتقديم",
      price: "من 200₪",
      features: ["ترجمة معتمدة", "تدقيق الوثائق", "تنسيق حسب متطلبات الجامعة"],
      action: () => navigate('/contact')
    },
    {
      icon: Plane,
      title: "استخراج التأشيرة",
      description: "مساعدة كاملة في إجراءات التأشيرة الدراسية",
      price: "من 500₪",
      features: ["تحضير الملف", "حجز موعد السفارة", "مراجعة الطلب"],
      action: () => navigate('/contact')
    },
    {
      icon: Home,
      title: "البحث عن سكن",
      description: "مساعدة في العثور على سكن مناسب قريب من الجامعة",
      price: "من 300₪",
      features: ["بحث حسب الميزانية", "التواصل مع الملاك", "مراجعة العقد"],
      action: () => navigate('/contact')
    },
    {
      icon: CreditCard,
      title: "الخدمات المصرفية",
      description: "مساعدة في فتح حساب بنكي وإجراءات مالية",
      price: "من 150₪",
      features: ["فتح حساب بنكي", "بطاقة ائتمان", "تحويلات مالية"],
      action: () => navigate('/contact')
    },
    {
      icon: Users,
      title: "الدعم بعد الوصول",
      description: "مساعدة مستمرة بعد الوصول للبلد الجديد",
      price: "من 200₪/شهر",
      features: ["دعم هاتفي", "حل المشاكل", "نصائح للتأقلم"],
      action: () => navigate('/contact')
    },
    {
      icon: Calculator,
      title: "حاسبة التكاليف",
      description: "احسب تكلفة الدراسة والمعيشة بدقة",
      price: "مجاناً",
      features: ["تكلفة الدراسة", "تكلفة المعيشة", "مقارنة بين الدول"],
      action: () => navigate('/resources')
    },
    {
      icon: Brain,
      title: "اختبار مطابقة التخصص",
      description: "اكتشف التخصص الجامعي الأنسب لك",
      price: "مجاناً",
      features: ["اختبار شخصية", "تحليل الاهتمامات", "ترشيحات مخصصة"],
      action: () => navigate('/quiz')
    },
    {
      icon: HelpCircle,
      title: "استشارة مجانية",
      description: "احجز استشارة مجانية مع خبرائنا",
      price: "مجاناً",
      features: ["30 دقيقة مجاناً", "خبراء متخصصون", "إجابات فورية"],
      action: () => navigate('/contact')
    }
  ];

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {services.map((service, index) => (
            <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <service.icon className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-2">{service.title}</CardTitle>
                <div className="text-2xl font-bold text-primary mb-2">{service.price}</div>
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
                  {service.price === 'مجاناً' ? 'ابدأ الآن' : 'احجز الخدمة'}
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
