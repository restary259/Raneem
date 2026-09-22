import { useTranslation } from "react-i18next";
import DarbPageHero from "@/components/common/DarbPageHero";
import { DARB_PUBLIC_HERO_IMAGES } from "@/config/publicHeroImages";

const ContactHero = () => {
  const { t } = useTranslation(["contact", "common"]);

  return (
    <DarbPageHero
      compact
      imageUrl={DARB_PUBLIC_HERO_IMAGES.contact}
      imageAlt={t("contactHero.heroImageAlt")}
      eyebrow={t("contactHero.eyebrow")}
      title={t("common:pageHero.contact.title", "Contact DARB")}
      subtitle={t("contactHero.subtitle")}
    />
  );
};

export default ContactHero;