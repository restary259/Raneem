
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const AgentProgramHero = () => {
  const { t } = useTranslation('partnership');
  return (
    <section className="relative py-20 md:py-40 text-center text-white">
      <div className="absolute inset-0 bg-black/60 z-0">
        <img 
            src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=80" 
            alt="People working together" 
            className="w-full h-full object-cover opacity-50" 
        />
      </div>
      <div className="container mx-auto px-4 relative z-10 animate-fade-in">
        <h1 className="text-4xl md:text-6xl font-bold drop-shadow-lg">{t('partnershipHero.title')}</h1>
        <p className="mt-6 max-w-3xl mx-auto text-lg md:text-xl text-white/90 drop-shadow-md">
          {t('partnershipHero.subtitle')}
        </p>
        <div className="mt-8">
          <Button size="lg" variant="accent" asChild className="transition-transform duration-300 hover:scale-105">
            <a href="#register-agent">{t('partnershipHero.button')}</a>
          </Button>
        </div>
      </div>
    </section>
  );
};
export default AgentProgramHero;
