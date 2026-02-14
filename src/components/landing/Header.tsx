
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DesktopNav from './DesktopNav';
import MobileNav from './MobileNav';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useDirection } from '@/hooks/useDirection';

const Header = () => {
  const { t } = useTranslation();
  const { dir } = useDirection();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm" dir={dir}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo Side */}
          <div className="flex items-center flex-shrink-0">
            <Link to="/" className="flex items-center gap-2 whitespace-nowrap">
              <img 
                src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" 
                alt={t('loader.brand')} 
                className="h-8 md:h-10 w-auto object-contain flex-shrink-0"
                fetchPriority="high"
              />
              <span className="font-bold text-lg md:text-xl text-gray-900 hidden sm:block flex-shrink-0">{t('loader.brand')}</span>
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <div className="hidden md:block flex-1 mx-6 overflow-hidden min-w-0">
            <DesktopNav />
          </div>

          {/* Right Side: Language Switcher + Student Login */}
          <div className="hidden md:flex items-center gap-2">
            <LanguageSwitcher />
            <Link 
              to="/student-auth" 
              className="bg-orange-500 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-full font-medium hover:bg-orange-600 transition-colors text-sm md:text-base whitespace-nowrap"
            >
              {t('nav.studentLogin')}
            </Link>
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
