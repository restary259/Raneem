
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LanguageSwitcher = ({ className = '' }: { className?: string }) => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLanguage}
        className="flex items-center gap-1.5 font-medium text-sm"
        aria-label={i18n.language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      >
        <Globe className="h-4 w-4" />
        <span>{i18n.language === 'ar' ? 'EN' : 'عربي'}</span>
      </Button>
    </div>
  );
};

export default LanguageSwitcher;
