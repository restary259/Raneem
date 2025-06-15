
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const CallToAction = () => {
  const { t } = useTranslation();
  return (
    <section className="py-24 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold">{t('callToAction.title')}</h2>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-primary-foreground/80">
          {t('callToAction.subtitle')}
        </p>
        <Button asChild size="lg" className="mt-8 bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-10 py-6 text-lg rounded-full shadow-lg transition-transform transform hover:scale-105">
          <Link to="/contact">{t('callToAction.button')}</Link>
        </Button>
      </div>
    </section>
  );
};
export default CallToAction;
