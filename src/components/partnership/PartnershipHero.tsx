import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import DarbPageHero from "@/components/common/DarbPageHero";
import { DARB_PUBLIC_HERO_IMAGES } from "@/config/publicHeroImages";

const PartnershipHero = () => {
  const { t } = useTranslation("partnership");
  return (
    <DarbPageHero
      eyebrow={t("partnershipHero.eyebrow", "DARB PARTNERSHIP")}
      imageUrl={DARB_PUBLIC_HERO_IMAGES.collaboration}
      imageAlt={t("partnershipHero.imageAlt", "Professional collaboration in an education environment")}
      title={t("partnershipHero.title")}
      subtitle={t("partnershipHero.subtitle")}
    >
      <Button size="lg" variant="accent" asChild>
        <a href="#register">{t("partnershipHero.button")}</a>
      </Button>
    </DarbPageHero>
  );
};
export default PartnershipHero;
