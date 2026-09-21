import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = ({ className = '' }: { className?: string }) => {
  const { i18n } = useTranslation();
  const current = i18n.language;

  return (
    <div
      className={`flex shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 px-1 py-1 sm:gap-1.5 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 ${className}`}
      dir="ltr"
      aria-label="Language selector"
    >
      <button
        type="button"
        onClick={() => i18n.changeLanguage('ar')}
        className={`inline-flex h-7 items-center rounded-md px-1.5 text-[11px] leading-none whitespace-nowrap underline-offset-4 transition-colors hover:bg-accent hover:underline sm:px-1 sm:text-sm ${current === 'ar' ? 'font-bold text-foreground' : 'text-muted-foreground'}`}
        aria-label="العربية"
        aria-current={current === 'ar' ? 'true' : undefined}
      >
        العربية
      </button>
      <span aria-hidden="true" className="text-[10px] text-muted-foreground/50 sm:text-xs">|</span>
      <button
        type="button"
        onClick={() => i18n.changeLanguage('en')}
        className={`inline-flex h-7 items-center rounded-md px-1.5 text-[11px] leading-none whitespace-nowrap underline-offset-4 transition-colors hover:bg-accent hover:underline sm:px-1 sm:text-sm ${current === 'en' ? 'font-bold text-foreground' : 'text-muted-foreground'}`}
        aria-label="English"
        aria-current={current === 'en' ? 'true' : undefined}
      >
        English
      </button>
      <span aria-hidden="true" className="text-[10px] text-muted-foreground/50 sm:text-xs">|</span>
      <button
        type="button"
        onClick={() => i18n.changeLanguage('he')}
        className={`inline-flex h-7 items-center rounded-md px-1.5 text-[11px] leading-none whitespace-nowrap underline-offset-4 transition-colors hover:bg-accent hover:underline sm:px-1 sm:text-sm ${current === 'he' ? 'font-bold text-foreground' : 'text-muted-foreground'}`}
        aria-label="עברית"
        aria-current={current === 'he' ? 'true' : undefined}
      >
        עברית
      </button>
    </div>
  );
};

export default LanguageSwitcher;
