
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calculator, 
  DollarSign, 
  GraduationCap, 
  Brain,
  FileText,
  Globe,
  Users,
  MessageCircle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdditionalServices = () => {
  const navigate = useNavigate();

  const additionalServices = [
    {
      id: 'cost-calculator',
      title: 'حاسبة تكاليف الدراسة',
      description: 'احسب تكلفة دراستك في الخارج بدقة',
      icon: Calculator,
      action: () => {
        // Scroll to cost calculator section
        const element = document.getElementById('cost-calculator');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    },
    {
      id: 'currency-converter',
      title: 'محول العملات',
      description: 'تحويل العملات بأسعار محدثة يومياً',
      icon: DollarSign,
      action: () => {
        const element = document.getElementById('currency-converter');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    },
    {
      id: 'gpa-calculator',
      title: 'حاسبة المعدل التراكمي',
      description: 'احسب معدلك التراكمي وفقاً للنظام الألماني',
      icon: GraduationCap,
      action: () => {
        const element = document.getElementById('gpa-calculator');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    },
    {
      id: 'major-quiz',
      title: 'اختبار مطابقة التخصص',
      description: 'اكتشف التخصص الجامعي الأنسب لشخصيتك',
      icon: Brain,
      action: () => navigate('/quiz')
    },
    {
      id: 'admission-guide',
      title: 'دليل القبول الجامعي',
      description: 'كل ما تحتاج معرفته عن عملية القبول',
      icon: FileText,
      action: () => navigate('/blog')
    },
    {
      id: 'visa-guide',
      title: 'دليل التأشيرات الدراسية',
      description: 'خطوات الحصول على التأشيرة الدراسية',
      icon: Globe,
      action: () => navigate('/blog')
    },
    {
      id: 'housing-guide',
      title: 'دليل السكن الطلابي',
      description: 'أفضل خيارات السكن للطلاب الدوليين',
      icon: Users,
      action: () => navigate('/blog')
    },
    {
      id: 'consultation',
      title: 'استشارة مجانية',
      description: 'احجز استشارة مجانية مع خبرائنا',
      icon: MessageCircle,
      action: () => window.open('https://wa.me/972529402168', '_blank')
    }
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-center mb-8">خدمات إضافية</h3>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {additionalServices.map((service) => (
          <Card 
            key={service.id} 
            className="group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            onClick={service.action}
          >
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <service.icon className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg line-clamp-2">{service.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-center pt-0">
              <CardDescription className="text-sm mb-4 line-clamp-2">
                {service.description}
              </CardDescription>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full group-hover:bg-primary group-hover:text-white transition-colors"
              >
                استخدم الآن
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdditionalServices;
