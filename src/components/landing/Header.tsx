
import React from 'react';
import { Link } from '@/lib/router-compat';
import { useTranslation } from 'react-i18next';
import DesktopNav from './DesktopNav';
import MobileNav from './MobileNav';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useDirection } from '@/hooks/useDirection';
import darbLogoAsset from '@/assets/darb-logo.png.asset.json';
import { Mail, Phone } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/lib/contactConfig';

const Header = () => {
  const { t } = useTranslation();
  const { dir } = useDirection();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background shadow-xs" dir={dir}>
      <div className="hidden border-b border-border bg-muted/35 lg:block">
        <div className="container flex h-9 items-center justify-end gap-5 text-xs text-muted-foreground">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-1.5 hover:text-brand-strong"><Mail className="h-3.5 w-3.5" />{SUPPORT_EMAIL}</a>
          <a href={`tel:${SUPPORT_PHONE}`} dir="ltr" className="flex items-center gap-1.5 hover:text-brand-strong"><Phone className="h-3.5 w-3.5" />{SUPPORT_PHONE}</a>
          <LanguageSwitcher />
        </div>
      </div>
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between lg:h-24">
          {/* Logo Side */}
          <div className="flex items-center flex-shrink-0 min-w-0">
            <Link to="/" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
              <img 
                src={darbLogoAsset.url}
                alt={t('loader.brand')} 
                className="h-14 w-auto flex-shrink-0 object-contain lg:h-20"
                style={{ minWidth: '3rem' }}
                fetchPriority="high"
              />
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <div className="hidden lg:block flex-1 mx-5 min-w-0">
            <DesktopNav />
          </div>

          {/* Right Side: Language Switcher + Student Login */}
          <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
            <Link 
              to="/student-auth" 
              className="flex-shrink-0 whitespace-nowrap rounded-md bg-brand-strong px-4 py-2 text-sm font-bold text-brand-foreground transition-colors hover:bg-brand-strong/90 md:px-5 md:py-2.5"
            >
              {t('nav.studentLogin')}
            </Link>
          </div>

          {/* Mobile Menu */}
          <div className="lg:hidden flex-shrink-0">
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
