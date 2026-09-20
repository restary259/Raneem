
import React from 'react';
import { Link } from '@/lib/router-compat';
import { useTranslation } from 'react-i18next';
import DesktopNav from './DesktopNav';
import MobileNav from './MobileNav';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useDirection } from '@/hooks/useDirection';
import darbLogoAsset from '@/assets/darb-logo.png.asset.json';

const Header = () => {
  const { t } = useTranslation();
  const { dir } = useDirection();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-xs backdrop-blur" dir={dir}>
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between md:h-20">
          {/* Logo Side */}
          <div className="flex items-center flex-shrink-0 min-w-0">
            <Link to="/" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
              <img 
                src={darbLogoAsset.url}
                alt={t('loader.brand')} 
                className="h-12 w-auto flex-shrink-0 object-contain md:h-14"
                style={{ minWidth: '3rem' }}
                fetchPriority="high"
              />
              <span 
                className="hidden flex-shrink-0 whitespace-nowrap font-bold text-primary sm:block"
                style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)' }}
              >
                {t('loader.brand')}
              </span>
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <div className="hidden md:block flex-1 mx-4 lg:mx-6 min-w-0">
            <DesktopNav />
          </div>

          {/* Right Side: Language Switcher + Student Login */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <LanguageSwitcher />
            <Link 
              to="/student-auth" 
              className="flex-shrink-0 whitespace-nowrap rounded-md bg-brand-strong px-4 py-2 text-sm font-bold text-brand-foreground transition-colors hover:bg-brand-strong/90 md:px-5 md:py-2.5"
            >
              {t('nav.studentLogin')}
            </Link>
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden flex-shrink-0">
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
