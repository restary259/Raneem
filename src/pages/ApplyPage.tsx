import React from "react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import ApplyForm from "@/components/apply/ApplyForm";
import DarbPageHero from "@/components/common/DarbPageHero";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { DARB_PUBLIC_HERO_IMAGES } from "@/config/publicHeroImages";
import darbLogoAsset from "@/assets/darb-logo.png.asset.json";
import { useDirection } from "@/hooks/useDirection";
import { useTranslation } from "react-i18next";

const ApplyPage: React.FC = () => {
  const { dir } = useDirection();
  const { t } = useTranslation("landing");

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground">
      {/* Desktop: keep the normal DARB website experience. */}
      <div className="hidden md:block">
        <Header />
        <main>
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

      {/* Mobile: standalone Instagram-first lead form. No site hero, full navigation,
          footer, or bottom navigation — only a compact DARB identity bar. */}
      <div className="md:hidden min-h-screen">
        <header className="sticky top-0 z-40 border-b border-border bg-background">
          <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
            <a href="/" aria-label={t("loader.brand")} className="flex items-center">
              <img
                src={darbLogoAsset.url}
                alt={t("loader.brand")}
                className="h-9 w-auto object-contain"
                fetchPriority="high"
              />
            </a>
            <LanguageSwitcher className="[&>button]:text-xs [&>span]:text-xs" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-lg px-3 pb-8">
          <section className="px-2 pt-4 pb-2 text-center">
            <p className="mx-auto max-w-md text-sm font-medium leading-6 text-muted-foreground">
              {t(
                "apply.whatsappNotice",
                "After you submit your information, the DARB team will contact you on WhatsApp."
              )}
            </p>
          </section>

          <ApplyForm embedded />
        </main>
      </div>
    </div>
  );
};

export default ApplyPage;
