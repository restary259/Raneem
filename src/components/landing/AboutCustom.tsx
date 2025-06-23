
import { useTranslation } from "react-i18next";
import AnimatedCounter from "@/components/landing/AnimatedCounter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const AboutCustom = () => {
  const { t } = useTranslation('landing');
  
  const stats = [
    {
      value: "47",
      label: "طالب راض",
      suffix: "+"
    },
    {
      value: "16", 
      label: "شريك",
      suffix: "+"
    },
    {
      value: "5",
      label: "دول حول العالم", 
      suffix: "+"
    },
    {
      value: "98",
      label: "نسبة النجاح",
      suffix: "%"
    }
  ];

  return (
    <section className="py-16 md:py-24 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4">
            نبذة عنا
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            درب - بوابتك لمستقبل تعليمي مشرق
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            نحن في "درب" نؤمن بأن كل طالب يستحق الفرصة لتحقيق أحلامه التعليمية. 
            منذ تأسيسنا، نعمل على ربط الطلاب العرب بأفضل الجامعات والمؤسسات التعليمية حول العالم، 
            مع تقديم الدعم الشامل والاستشارة المتخصصة في كل خطوة من رحلتهم التعليمية.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <Card key={index} className="text-center bg-card/50 backdrop-blur-sm hover:bg-card transition-all duration-300 hover:scale-105">
              <CardContent className="p-6">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                  <AnimatedCounter 
                    value={parseInt(stat.value)} 
                    suffix={stat.suffix}
                  />
                </div>
                <p className="text-sm md:text-base text-muted-foreground font-medium">
                  {stat.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            مع فريق من الخبراء المتخصصين والشراكات القوية مع أفضل المؤسسات التعليمية، 
            نحن هنا لنجعل حلم الدراسة في الخارج حقيقة ملموسة.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AboutCustom;
