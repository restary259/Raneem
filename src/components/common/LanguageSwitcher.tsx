import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LANG_ORDER = ['ar', 'en', 'he'] as const;
type Lang = (typeof LANG_ORDER)[number];

const LABELS: Record<Lang, string> = {
  ar: 'عربي',
  en: 'EN',
  he: 'עברית',
};

const LanguageSwitcher = ({ className = '' }: { className?: string }) => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const current = (LANG_ORDER.includes(i18n.language as Lang) ? i18n.language : 'ar') as Lang;
    const nextIndex = (LANG_ORDER.indexOf(current) + 1) % LANG_ORDER.length;
    i18n.changeLanguage(LANG_ORDER[nextIndex]);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLanguage}
        className="flex items-center gap-1.5 font-medium text-sm"
        aria-label={`Change language (next: ${LABELS[i18n.language === 'ar' ? 'en' : i18n.language === 'he' ? 'ar' : 'he']})`}
      >
        <Globe className="h-4 w-4" />
        <span>{i18n.language === 'ar' ? 'EN' : i18n.language === 'he' ? 'عربي' : 'עברית'}</span>
      </Button>
    </div>
  );
};

export default LanguageSwitcher;