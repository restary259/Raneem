import React, { useEffect, useState } from 'react';
import { Link } from '@/lib/router-compat';
import { useTranslation } from 'react-i18next';
import DesktopNav from './DesktopNav';
import MobileNav from './MobileNav';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useDirection } from '@/hooks/useDirection';
import darbLogoAsset from '@/assets/darb-logo.png.asset.json';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/lib/contactConfig';

const Header = () => {
  const { t } = useTranslation();
  const { dir } = useDirection();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 24);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => window.removeEventListener('scroll', updateHeader);
  }, []);

  return (
    <header
      className={`relative inset-x-0 top-0 z-50 lg:fixed transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled
          ? 'border-b border-border bg-background/95 shadow-surface backdrop-blur-md'
          : 'border-b border-transparent bg-background lg:bg-transparent'
      }`}
      dir={dir}
      data-scrolled={scrolled ? 'true' : 'false'}
    >
      {/* Desktop utility bar */}
      <div className="hidden border-b border-primary-foreground/20 lg:block">
        <div
          dir="ltr"
          className={`container grid h-9 grid-cols-[1fr_auto_1fr] items-center px-4 text-xs sm:text-sm ${
            scrolled ? 'text-muted-foreground' : 'text-primary-foreground'
          }`}
        >
          <div className="justify-self-start">
            <LanguageSwitcher />
          </div>
          <a href={`tel:${SUPPORT_PHONE}`} dir="ltr" className="justify-self-center whitespace-nowrap">
            {SUPPORT_PHONE}
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="justify-self-end whitespace-nowrap">
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex min-h-20 items-center justify-between lg:h-24 lg:min-h-0" dir="ltr">
          {/* Logo */}
          <div className="flex min-w-0 flex-shrink-0 items-center">
            <Link to="/" className="flex flex-shrink-0 items-center whitespace-nowrap">
              <img
                src={darbLogoAsset.url}
                alt={t('loader.brand')}
                className="h-12 w-auto flex-shrink-0 object-contain lg:h-20"
                fetchPriority="high"
              />
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden min-w-0 flex-1 lg:mx-5 lg:block">
            <DesktopNav transparent={!scrolled} />
          </div>

          {/* Desktop student login */}
          <div className="hidden flex-shrink-0 items-center gap-2 lg:flex">
            <Link
              to="/student-auth"
              className="flex-shrink-0 whitespace-nowrap rounded-md bg-brand-strong px-4 py-2 text-sm font-bold text-brand-foreground transition-colors hover:bg-brand-strong/90 md:px-5 md:py-2.5"
            >
              {t('nav.studentLogin')}
            </Link>
          </div>

          {/* Mobile utility header: contact line, languages, hamburger */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 lg:hidden" dir="ltr">
            <div className="flex min-w-0 flex-1 flex-col items-end justify-center text-foreground">
              <div className="flex max-w-full items-center justify-end gap-1.5 whitespace-nowrap text-[9px] font-medium leading-none sm:text-[10px]">
                <a
                  href={`tel:${SUPPORT_PHONE}`}
                  className="shrink-0"
                  aria-label={`Call ${SUPPORT_PHONE}`}
                >
                  {SUPPORT_PHONE}
                </a>
                <span aria-hidden="true" className="text-muted-foreground">|</span>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="min-w-0 max-w-[118px] truncate text-muted-foreground"
                  aria-label={`Email ${SUPPORT_EMAIL}`}
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <LanguageSwitcher className="mt-1 [&>button]:text-[10px] [&>span]:text-[10px]" />
            </div>

            <MobileNav transparent={false} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
