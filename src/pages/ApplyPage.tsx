import React from "react";
import Header from "@/components/landing/Header";
import ApplyForm from "@/components/apply/ApplyForm";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import darbLogoAsset from "@/assets/darb-logo.png.asset.json";
import { useDirection } from "@/hooks/useDirection";
import { useTranslation } from "react-i18next";

const ApplyPage: React.FC = () => {
  const { dir } = useDirection();
  const { t } = useTranslation("landing");

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground">
      <div className="hidden border-b border-border md:block"><Header /></div>
      <header className="border-b border-border bg-background md:hidden">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
          <a href="/" aria-label={t("loader.brand")} className="flex items-center">
            <img src={darbLogoAsset.url} alt={t("loader.brand")} className="h-9 w-auto object-contain" fetchPriority="high" />
          </a>
          <LanguageSwitcher className="[&>button]:text-xs [&>span]:text-xs" />
        </div>
      </header>
      <main><ApplyForm /></main>
    </div>
  );
};

export default ApplyPage;
