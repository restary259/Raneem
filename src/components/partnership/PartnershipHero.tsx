
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const PartnershipHero = () => {
  return (
    <section className="py-20 md:py-32 text-center bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold">
          اربح وامنح طلابك خصم 500 شيكل – انضم إلى برنامج الشراكة الآن!
        </h1>
        <p className="mt-6 max-w-3xl mx-auto text-lg md:text-xl text-primary-foreground/80">
          عندما يذكر الطالب اسمك عند التسجيل، يحصل على خصم فوري بقيمة 500 شيكل، وأنت تحصل على 50% من قيمة خدماتنا كعمولة. نحن نوفر لك كل الدعم الذي تحتاجه للنجاح.
        </p>
        <div className="mt-8">
          <Button size="lg" variant="accent" asChild>
            <a href="#register">سجل الآن وابدأ الربح</a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PartnershipHero;
