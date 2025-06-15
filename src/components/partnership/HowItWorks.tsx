
import { FileSignature, Share2, UserCheck, BadgePercent } from 'lucide-react';

const steps = [
  { icon: FileSignature, title: "سجل معنا", description: "املأ النموذج في الأسفل لتنضم إلى شبكة شركائنا." },
  { icon: Share2, title: "شارك اسمك أو رابطك", description: "شارك اسمك أو الرابط الخاص بك مع الطلاب المهتمين بالدراسة في الخارج." },
  { icon: UserCheck, title: "يحصل الطالب على خصم", description: "عندما يذكر الطالب اسمك عند التسجيل، يحصل على خصم فوري بقيمة 500 شيكل." },
  { icon: BadgePercent, title: "تحصل على 50% عمولة", description: "نرسل لك 50% من قيمة الباقة مباشرة بعد إتمام الطالب لعملية الدفع." },
];

const HowItWorks = () => {
  return (
    <section className="py-12 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">كيف يعمل البرنامج؟</h2>
        <div className="relative">
          <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-border -translate-y-1/2"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center p-4 z-10">
                <div className="bg-primary text-primary-foreground rounded-full h-16 w-16 flex items-center justify-center mb-4">
                  <step.icon className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
