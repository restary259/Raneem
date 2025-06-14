
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const CeoMessage = () => (
  <section className="py-12 md:py-24">
    <div className="container mx-auto px-4">
      <div className="max-w-4xl mx-auto bg-white/50 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/30" style={{direction: 'rtl'}}>
        <div className="flex flex-col md:flex-row-reverse items-center gap-8">
          <Avatar className="h-32 w-32 flex-shrink-0 border-4 border-white shadow-md">
            <AvatarImage src="https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=300&auto=format&fit=crop" alt="CEO" />
            <AvatarFallback>CEO</AvatarFallback>
          </Avatar>
          <div className="text-right">
            <h3 className="font-cairo text-2xl font-bold text-primary">رسالة من المدير التنفيذي</h3>
            <blockquote className="mt-4 text-muted-foreground italic border-r-4 border-accent pr-4">
              "رؤيتنا في 'درب' هي تمهيد الطريق أمام كل طالب طموح لتحقيق حلمه بالدراسة في الخارج. نحن لا نقدم استشارات فحسب، بل نبني جسورًا من الثقة والدعم لضمان رحلة تعليمية ناجحة ومستقبل مشرق."
            </blockquote>
            <p className="mt-4 font-bold text-primary">- أحمد العلي، المؤسس والمدير التنفيذي</p>
          </div>
        </div>
      </div>
    </div>
  </section>
);
export default CeoMessage;
