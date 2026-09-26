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
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 24);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => window.removeEventListener('scroll', updateHeader);
  }, []);

  // Mobile/tablet (<1024px) always gets a solid header — the transparent
  // look is reserved for the desktop hero.
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1280px)');
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  const solid = scrolled || !isDesktop;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 ${
        solid
          ? 'border-b border-border bg-background/95 shadow-surface backdrop-blur-md'
          : 'border-transparent bg-transparent shadow-none'
      }`}
      dir={dir}
      data-scrolled={solid ? 'true' : 'false'}
    >
      {/* Desktop utility bar */}
      <div className={`darb-header-utility hidden xl:block ${solid ? 'border-b border-border' : 'border-b border-primary-foreground/20'}`}>
        <div
          dir="ltr"
          className={`container grid h-full grid-cols-[1fr_auto_1fr] items-center px-4 text-xs sm:text-sm ${
            solid ? 'text-muted-foreground' : 'text-primary-foreground'
          }`}
        >
          <div className="justify-self-start">
              <LanguageSwitcher className={solid ? '' : 'drop-shadow-sm'} />
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
        <div className="darb-header-main flex items-center justify-between" dir="ltr">
          {/* Logo */}
          <div className="flex min-w-0 shrink-0 items-center">
            <Link to="/" aria-label={t('loader.brand')} className="flex h-12 w-[132px] shrink-0 items-center sm:h-14 sm:w-[156px] lg:h-16 lg:w-[182px]">
              <img
                src={darbLogoAsset.url}
                alt={t('loader.brand')}
                width={182}
                height={64}
                decoding="async"
                fetchPriority="high"
                className="darb-header-logo block h-auto max-h-full w-auto max-w-full object-contain object-left"
              />
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden min-w-0 flex-1 xl:mx-5 xl:block">
            <DesktopNav transparent={!solid} />
          </div>

          {/* Desktop login + apply */}
          <div className="hidden flex-shrink-0 items-center gap-2 xl:flex">
            <Link
              to="/student-auth"
              className={`inline-flex min-h-11 flex-shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${solid ? 'text-foreground hover:text-primary' : 'text-primary-foreground drop-shadow-sm hover:opacity-80'}`}
            >
              {t('nav.studentLogin')}
            </Link>
             <Link
               to="/apply"
               className="inline-flex min-h-11 flex-shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-brand px-6 text-sm font-bold text-brand-foreground shadow-surface transition-colors hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
             >
              {t('hero.apply')}
            </Link>
          </div>

           {/* Mobile header: preserve breathing room and move contact details into the menu. */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 xl:hidden" dir="ltr">
             <LanguageSwitcher className={`shrink-0 [&>button]:min-h-11 [&>button]:px-2 [&>button]:text-xs [&>span]:text-xs ${solid ? 'text-foreground' : 'text-primary-foreground drop-shadow-sm'}`} />
            <MobileNav transparent={!solid} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
