
import React from 'react';
import { GraduationCap, FileText, BookOpen, CreditCard, Home, Compass, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useInView } from 'react-intersection-observer';
import { cn } from '@/lib/utils';

const services = [
  {
    icon: Users,
    title: "الاستشارات الشخصية",
    description: "جلسة استشارية خاصة لتقييم ملفك الأكاديمي وتحديد أفضل الجامعات والمسارات لك.",
  },
  {
    icon: GraduationCap,
    title: "التقديم الجامعي",
    description: "نساعدك في اختيار التخصص المناسب، تجهيز ملفك بشكل احترافي، وتقديمه لأفضل الجامعات.",
  },
  {
    icon: BookOpen,
    title: "دورات اللغة",
    description: "نحجز لك مقعدًا في أفضل معاهد اللغة المعتمدة لمساعدتك على تلبية متطلبات القبول.",
  },
  {
    icon: FileText,
    title: "الترجمة والتوثيق",
    description: "نوفر ترجمة قانونية معتمدة لجميع وثائقك وتصديقها من الجهات الرسمية المطلوبة.",
  },
  {
    icon: CreditCard,
    title: "التأشيرات والإقامة",
    description: "فريقنا خبير في تجهيز ملف السفارة، حجز المواعيد، ومتابعة طلبك للحصول على التأشيرة.",
  },
  {
    icon: Home,
    title: "خدمات السكن",
    description: "نساعدك في العثور على سكن طلابي آمن أو شقة خاصة تناسب ميزانيتك وقريبة من جامعتك.",
  },
  {
    icon: Compass,
    title: "الاستقبال والمتابعة",
    description: "نستقبلك في المطار ونرافقك في خطواتك الأولى لضمان بداية سلسة ومريحة في بلدك الجديد.",
  },
];

type Service = typeof services[0];

const ServiceStep = ({ service, index, isLast }: { service: Service, index: number, isLast: boolean }) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <div
      ref={ref}
      className={cn(
        "flex gap-x-6 md:gap-x-8",
        inView ? 'opacity-100 animate-in fade-in-0 slide-in-from-top-5 duration-700' : 'opacity-0'
      )}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      {/* Timeline Column */}
      <div className="flex flex-col items-center">
        <div className="flex-shrink-0 w-12 h-12 bg-background border-2 border-primary rounded-full flex items-center justify-center text-primary font-bold text-xl z-10">
          {index + 1}
        </div>
        {!isLast && <div className="w-0.5 mt-2 flex-grow bg-border" />}
      </div>
      
      {/* Card Column */}
      <div className="flex-grow pt-2 pb-8">
        <Card className="transition-all duration-300 hover:shadow-xl hover:border-accent cursor-pointer">
          <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
            <div className="p-2 bg-accent/10 rounded-md">
              <service.icon className="h-8 w-8 text-accent" />
            </div>
            <CardTitle className="font-cairo text-lg md:text-xl">{service.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{service.description}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


const ServicesGrid = () => (
  <section className="py-12 md:py-24 bg-secondary">
    <div className="container mx-auto px-4">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-3xl md:text-4xl font-bold font-cairo text-primary">رحلتك الدراسية خطوة بخطوة</h2>
        <p className="mt-4 text-lg text-muted-foreground">
          نقدم باقة متكاملة من الخدمات المصممة لتسهيل كل خطوة في رحلتك الدراسية، من الاستشارة الأولية حتى الاستقرار في بلد الدراسة.
        </p>
      </div>
      <div className="max-w-3xl mx-auto flex flex-col">
        {services.map((service, index) => (
          <ServiceStep 
            key={index} 
            service={service} 
            index={index} 
            isLast={index === services.length - 1}
          />
        ))}
      </div>
    </div>
  </section>
);

export default ServicesGrid;
