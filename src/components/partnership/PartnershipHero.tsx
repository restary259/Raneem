
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const PartnershipHero = () => {
  const { t } = useTranslation('partnership');
  return <section className="py-20 md:py-32 text-center bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold">{t('partnershipHero.title')}</h1>
        <p className="mt-6 max-w-3xl mx-auto text-lg md:text-xl text-primary-foreground/80">
          {t('partnershipHero.subtitle')}
        </p>
        <div className="mt-8">
          <Button size="lg" variant="accent" asChild>
            <a href="#register">{t('partnershipHero.button')}</a>
          </Button>
        </div>
      </div>
    </section>;
};
export default PartnershipHero;
