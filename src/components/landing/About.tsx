
import { CheckCircle } from "lucide-react";

const keyPoints = [
  "مقرنا في ألمانيا والأردن ورومانيا",
  "نخدم الطلاب المحليين والدوليين",
  "فريق متعدد اللغات (العربية، الإنجليزية، الألمانية)",
  "أسعار شفافة وشركاء موثوقون",
];

const About = () => {
  return (
    <section id="about" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold">من نحن</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            درب للدراسة الدولية هي شركة استشارات تعليمية تركز على الطلاب، وتساعد الطلاب من الشرق الأوسط وخارجه للدراسة في أوروبا - وخاصة ألمانيا ورومانيا والأردن. نحن نقدم دعمًا شخصيًا وكاملاً للعملية بنسبة نجاح 97٪ وشغف بنجاح الطلاب.
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 text-right">
            {keyPoints.map((point, index) => (
              <div key={index} className="flex items-start space-x-3 flex-row-reverse">
                <CheckCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <p className="text-md">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
