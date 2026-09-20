import React from "react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import ApplyForm from "@/components/apply/ApplyForm";
import DarbPageHero from "@/components/common/DarbPageHero";
import { DARB_PUBLIC_HERO_IMAGES } from "@/config/publicHeroImages";
import { useDirection } from "@/hooks/useDirection";
import { useTranslation } from "react-i18next";

const ApplyPage: React.FC = () => {
  const { dir } = useDirection();
  const { t } = useTranslation("landing");

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-grow">
        <DarbPageHero
          compact
          eyebrow={t("applyHero.eyebrow", "START YOUR JOURNEY")}
          imageUrl={DARB_PUBLIC_HERO_IMAGES.academic}
          imageAlt={t("applyHero.imageAlt", "Student preparing an application for study in Germany")}
          title={t("applyHero.title", "Tell us about your study plans")}
          subtitle={t("applyHero.subtitle", "Share your details so DARB can understand your profile and the next step for Germany.")}
        />
        <ApplyForm />
      </main>
      <Footer />
    </div>
  );
};

export default ApplyPage;
