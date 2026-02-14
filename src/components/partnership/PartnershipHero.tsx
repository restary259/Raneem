
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import PageHero from "@/components/common/PageHero";

const PartnershipHero = () => {
  const { t } = useTranslation('partnership');
  return (
    <PageHero
      variant="image"
      imageUrl="https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=80"
      title={t('partnershipHero.title')}
      subtitle={t('partnershipHero.subtitle')}
    >
      <Button size="lg" variant="accent" asChild className="transition-transform duration-300 hover:scale-105">
        <a href="#register">{t('partnershipHero.button')}</a>
      </Button>
    </PageHero>
  );
};
export default PartnershipHero;
