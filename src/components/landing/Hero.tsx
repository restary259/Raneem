
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="relative h-[80vh] min-h-[500px] flex items-center justify-center text-white">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1523240795610-57171367a0b8?q=80&w=2070&auto=format&fit=crop')",
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
      </div>
      <div className="relative z-10 text-center px-4">
        <h1 className="text-4xl md:text-6xl font-bold leading-tight">
          بوابتك للدراسة في ألمانيا، رومانيا، والأردن
        </h1>
        <p className="mt-4 text-lg md:text-xl max-w-3xl mx-auto">
          نوجه الطلاب خطوة بخطوة للدراسة في الخارج — من اختيار الجامعة المناسبة حتى الوصول إلى وطنك الجديد.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <Button size="lg" asChild variant="accent">
            <a href="#contact">احجز استشارة مجانية</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#contact">قدم الآن</a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
