
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const PartnershipHero = () => {
  return (
    <section className="py-20 md:py-32 text-center bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold">
          اربح مع Darb Study International – انضم لبرنامج شركائنا الآن
        </h1>
        <p className="mt-6 max-w-3xl mx-auto text-lg md:text-xl text-primary-foreground/80">
          إذا كنت تمتلك جمهوراً مهتماً بالدراسة في الخارج، يمكنك الآن تحويله إلى دخل حقيقي.
        </p>
        <div className="mt-8">
          <Button size="lg" variant="accent" asChild>
            <a href="#register">سجل الآن وابدأ الكسب</a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PartnershipHero;
