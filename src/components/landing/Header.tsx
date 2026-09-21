import React, { useEffect, useState } from 'react';
import { Link } from '@/lib/router-compat';
import { useTranslation } from 'react-i18next';
import DesktopNav from './DesktopNav';
import MobileNav from './MobileNav';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useDirection } from '@/hooks/useDirection';
import darbLogoAsset from '@/assets/darb-logo.png.asset.json';
import { SUPPORT_EMAIL, SUPPORT_PHONE, whatsappBusinessUrl } from '@/lib/contactConfig';

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
      <div className="darb-header-utility hidden border-b border-primary-foreground/20 lg:block">
        <div
          dir="ltr"
          className={`container grid h-full grid-cols-[1fr_auto_1fr] items-center px-4 text-xs sm:text-sm ${
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
          <div className="hidden min-w-0 flex-1 lg:mx-5 lg:block">
            <DesktopNav transparent={!scrolled} />
          </div>

          {/* Desktop student login */}
          <div className="hidden flex-shrink-0 items-center gap-2 lg:flex">
            <Link
              to="/student-auth"
              className="flex-shrink-0 whitespace-nowrap rounded-md border border-brand bg-brand-strong px-4 py-2.5 text-sm font-bold text-brand-foreground shadow-[0_8px_22px_-12px_hsl(var(--brand)/0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand px-5 md:px-6 md:py-3"
            >
              {t('nav.studentLogin')}
            </Link>
          </div>

          {/* Mobile utility header: fixed left logo, readable contact details, languages, fixed right menu */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 lg:hidden" dir="ltr">
            <div className="flex min-w-0 flex-1 flex-col items-end justify-center text-foreground">
              <a
                href={whatsappBusinessUrl("مرحبا، بدي أتواصل مع فريق درب بخصوص الدراسة بألمانيا.")}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-full whitespace-nowrap text-[11px] font-semibold leading-tight hover:text-brand-strong sm:text-xs"
                aria-label="WhatsApp: +49 176 23790623"
              >
                +49 176 23790623
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-0.5 max-w-full truncate text-[11px] leading-tight text-muted-foreground hover:text-foreground sm:text-xs"
                aria-label={`Email ${SUPPORT_EMAIL}`}
              >
                {SUPPORT_EMAIL}
              </a>
              <LanguageSwitcher className="mt-1 [&>button]:text-[10px] sm:[&>button]:text-[11px] [&>span]:text-[10px] sm:[&>span]:text-[11px]" />
            </div>

            <MobileNav transparent={false} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
