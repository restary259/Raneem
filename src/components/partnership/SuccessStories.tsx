
import { Card, CardContent } from "@/components/ui/card";
import { Quote } from 'lucide-react';

const testimonials = [
  { quote: "حققت 1,200 يورو في أول شهر فقط من 4 طلاب. البرنامج بسيط والعمولة ممتازة!", name: "سارة", from: "عمان" },
  { quote: "كصانع محتوى تعليمي، برنامج الشراكة هذا هو أفضل ما وجدته. شفافية ومصداقية ودعم حقيقي.", name: "محمد", from: "الرياض" },
  { quote: "فريق Darb Study ساعدني على تحويل شبكة علاقاتي إلى مصدر دخل إضافي بسهولة.", name: "علي", from: "برلين" },
];

const SuccessStories = () => {
  return (
    <section className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">قصص نجاح شركائنا</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="bg-background/70">
              <CardContent className="p-6">
                <Quote className="h-8 w-8 text-accent mb-4" />
                <blockquote className="text-lg text-primary italic">"{testimonial.quote}"</blockquote>
                <p className="mt-4 font-bold text-right">- {testimonial.name}، {testimonial.from}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SuccessStories;
