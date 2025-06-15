
import { Search, FileSignature, Plane, CheckCircle } from 'lucide-react';

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
  
const StudentJourney = () => {
    return (
        <section className="py-20 bg-background">
            <div className="container mx-auto px-4">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-primary">رحلتك نحو الدراسة في الخارج</h2>
                    <p className="mt-4 text-lg text-muted-foreground">
                        نحن معك خطوة بخطوة، من الفكرة إلى أول يوم دراسي.
                    </p>
                </div>
                <div className="relative">
                    <div className="hidden md:block absolute top-12 left-0 w-full h-1 bg-primary/20 rounded-full" />
                    <div className="grid md:grid-cols-4 gap-y-12 md:gap-x-8">
                        {steps.map((step, index) => (
                            <div key={index} className="flex flex-col items-center text-center relative px-4">
                                <div className="hidden md:block absolute bg-primary/20 w-1 h-8 -top-8" />
                                <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-background border-4 border-primary/20 shadow-lg">
                                  <div className="flex h-[80%] w-[80%] items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 hover:scale-110">
                                    <step.icon className="h-10 w-10" />
                                  </div>
                                </div>
                                <h3 className="mt-6 text-xl font-bold">{step.title}</h3>
                                <p className="mt-2 text-muted-foreground">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default StudentJourney;
