
import { useTranslation } from "react-i18next";
import AnimatedCounter from "@/components/landing/AnimatedCounter";

const AboutCustom = () => {
  const { t } = useTranslation('landing');
  
  const stats = [
    { value: "47", label: "طالب راض", suffix: "+" },
    { value: "16", label: "شريك", suffix: "+" },
    { value: "5", label: "دول حول العالم", suffix: "+" },
    { value: "98", label: "نسبة النجاح", suffix: "%" }
  ];

  return (
    <section id="about-stats" className="py-12 md:py-24 bg-secondary/50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">أرقامنا تتحدث</h2>
          <p className="mt-4 text-lg text-muted-foreground">الشفافية والنجاح هما أساس عملنا، وهذه الأرقام تعكس ثقة طلابنا بنا.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className="text-center p-4 sm:p-6 bg-background rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 opacity-0 animate-fade-in"
              style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'forwards' }}
            >
              <p className="text-2xl sm:text-4xl md:text-5xl font-bold text-primary">
                <AnimatedCounter end={Number(stat.value)} />
                {stat.suffix}
              </p>
              <p className="mt-2 text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutCustom;
