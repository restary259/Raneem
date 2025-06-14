
import React from 'react';
import { GraduationCap, FileText, BookOpen, Passport, Home, Compass, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

const services = [
  {
    icon: GraduationCap,
    title: "التقديم الجامعي",
    description: "نساعدك في اختيار التخصص المناسب، تجهيز ملفك بشكل احترافي، وتقديمه لأفضل الجامعات.",
  },
  {
    icon: FileText,
    title: "الترجمة والتوثيق",
    description: "نوفر ترجمة قانونية معتمدة لجميع وثائقك وتصديقها من الجهات الرسمية المطلوبة.",
  },
  {
    icon: BookOpen,
    title: "دورات اللغة",
    description: "نحجز لك مقعدًا في أفضل معاهد اللغة المعتمدة لمساعدتك على تلبية متطلبات القبول.",
  },
  {
    icon: Passport,
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
  {
    icon: Users,
    title: "الاستشارات الشخصية",
    description: "جلسة استشارية خاصة لتقييم ملفك الأكاديمي وتحديد أفضل الجامعات والمسارات لك.",
  },
];

const ServicesGrid = () => (
  <section className="py-12 md:py-24 bg-secondary">
    <div className="container mx-auto px-4">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="text-3xl md:text-4xl font-bold font-cairo text-primary">ما نقدمه من خدمات</h2>
        <p className="mt-4 text-lg text-muted-foreground">
          نقدم باقة متكاملة من الخدمات المصممة لتسهيل كل خطوة في رحلتك الدراسية.
        </p>
      </div>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service, index) => (
          <HoverCard key={index} openDelay={200}>
            <HoverCardTrigger asChild>
              <Card className="text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-2 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <service.icon className="h-12 w-12 text-accent" />
                  </div>
                  <CardTitle className="font-cairo">{service.title}</CardTitle>
                </CardHeader>
              </Card>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 text-right" dir="rtl">
              <p className="font-cairo text-sm text-popover-foreground">{service.description}</p>
            </HoverCardContent>
          </HoverCard>
        ))}
      </div>
    </div>
  </section>
);

export default ServicesGrid;
