
import React from 'react';
import { Search, FileSignature, Plane, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  {
    icon: Search,
    title: "الاستشارة والتقييم",
    description: "تبدأ رحلتك بجلسة استشارية مجانية لفهم أهدافك وتقييم ملفك.",
  },
  {
    icon: FileSignature,
    title: "تجهيز وتقديم الطلبات",
    description: "نساعدك في إعداد كافة المستندات وتقديم طلباتك للجامعات والسفارة.",
  },
  {
    icon: Plane,
    title: "الاستعداد للسفر",
    description: "بعد الحصول على القبول والتأشيرة، نساعدك في حجز السكن والتحضير للسفر.",
  },
  {
    icon: CheckCircle,
    title: "الدعم بعد الوصول",
    description: "نستقبلك ونقدم لك الدعم اللازم لتستقر وتبدأ دراستك بكل راحة.",
  },
];

interface ServiceProcessProps {
  title?: string;
  description?: string;
  className?: string;
}

const ServiceProcess: React.FC<ServiceProcessProps> = ({
  title = "رحلتك معنا في 4 خطوات",
  description = "نظام عملنا شفاف ومباشر لضمان أفضل النتائج.",
  className
}) => (
  <section className={cn("py-12 md:py-24", className)}>
    <div className="container mx-auto px-4">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-3xl md:text-4xl font-bold font-cairo text-primary">{title}</h2>
        <p className="mt-4 text-lg text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="relative max-w-5xl mx-auto">
        <div className="hidden md:block absolute top-8 left-0 w-full h-0.5 bg-border -translate-y-1/2"></div>
        <div className="grid gap-12 md:gap-8 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={index} className="text-center relative bg-background px-4">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-accent text-accent-foreground p-4 ring-8 ring-background">
                  <step.icon className="h-8 w-8" />
                </div>
              </div>
              <h3 className="text-xl font-bold font-cairo text-primary">{step.title}</h3>
              <p className="mt-2 text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default ServiceProcess;
