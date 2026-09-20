import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = ({ className = '' }: { className?: string }) => {
  const { i18n } = useTranslation();
  const current = i18n.language;

  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 ${className}`}
      dir="ltr"
      aria-label="Language selector"
    >
      <button
        type="button"
        onClick={() => i18n.changeLanguage('ar')}
        className={`text-sm underline-offset-4 hover:underline ${current === 'ar' ? 'font-bold' : 'opacity-75'}`}
        aria-label="العربية"
        aria-current={current === 'ar' ? 'true' : undefined}
      >
        العربية
      </button>
      <span aria-hidden="true" className="opacity-40">|</span>
      <button
        type="button"
        onClick={() => i18n.changeLanguage('en')}
        className={`text-sm underline-offset-4 hover:underline ${current === 'en' ? 'font-bold' : 'opacity-75'}`}
        aria-label="English"
        aria-current={current === 'en' ? 'true' : undefined}
      >
        English
      </button>
      <span aria-hidden="true" className="opacity-40">|</span>
      <button
        type="button"
        onClick={() => i18n.changeLanguage('he')}
        className={`text-sm underline-offset-4 hover:underline ${current === 'he' ? 'font-bold' : 'opacity-75'}`}
        aria-label="עברית"
        aria-current={current === 'he' ? 'true' : undefined}
      >
        עברית
      </button>
    </div>
  );
};

export default LanguageSwitcher;
