import React from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { key: "ar", nativeName: "العربية", lang: "ar" },
  { key: "en", nativeName: "English", lang: "en" },
  { key: "he", nativeName: "עברית", lang: "he" },
] as const;

const LanguageSwitcher = ({ className = "" }: { className?: string }) => {
  const { i18n, t } = useTranslation("dashboard");
  const current = i18n.resolvedLanguage ?? i18n.language;

  const isCurrent = (key: string) =>
    current === key || current.startsWith(key + "-");

  return (
    <div
      className={`flex shrink-0 items-center gap-1 sm:gap-3 ${className}`}
      dir="ltr"
      role="group"
      aria-label={t("nav.languageSelector")}
    >
      {LANGUAGES.map(({ key, nativeName, lang }, index) => (
        <React.Fragment key={key}>
          {index > 0 && (
            <span aria-hidden="true" className="text-xs opacity-40">
              |
            </span>
          )}
          <button
            type="button"
            lang={lang}
            onClick={() => i18n.changeLanguage(key)}
            className={`whitespace-nowrap text-xs underline-offset-4 transition-opacity hover:underline ${isCurrent(key) ? "font-bold" : "opacity-75"}`}
            aria-label={nativeName}
            aria-current={isCurrent(key) ? "true" : undefined}
          >
            {nativeName}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
