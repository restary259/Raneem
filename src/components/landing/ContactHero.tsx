import React from "react";
import { useTranslation } from "react-i18next";
import DarbPageHero from "@/components/common/DarbPageHero";
import { DARB_PUBLIC_HERO_IMAGES } from "@/config/publicHeroImages";

const ContactHero = () => {
  const { t } = useTranslation("contact");
  return (
    <DarbPageHero
      eyebrow={t("contactHero.eyebrow", "CONTACT DARB")}
      imageUrl={DARB_PUBLIC_HERO_IMAGES.city}
      imageAlt={t("contactHero.imageAlt", "Bright German city skyline")}
      title={t("contactHero.title")}
      subtitle={t("contactHero.subtitle", "Talk to DARB about studying, applications, language courses, visas, housing and your next step.")}
    />
  );
};

export default ContactHero;
