
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDarkMode } from '@/hooks/useDarkMode';

const LanguageSwitcher = ({ className = '' }: { className?: string }) => {
  const { i18n } = useTranslation();
  const { isDark, toggle } = useDarkMode();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        className="h-8 w-8 p-0"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
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
