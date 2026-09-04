
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Bot, User, FileText, MessageCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import { WHATSAPP_PHONE_URL } from '@/lib/contactConfig';

const BottomNav = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { dir } = useDirection();

  // Hide on influencer apply flow and dashboard pages
  const searchParams = new URLSearchParams(location.search);
  const isInfluencerApply = location.pathname === '/apply' && searchParams.has('ref');
  const isDashboard = ['/student-dashboard', '/admin', '/team-dashboard'].includes(location.pathname);

  if (!isMobile || isInfluencerApply || isDashboard) {
    return null;
  }

  if (location.pathname === '/') {
    return (
      <nav
        role="navigation"
        aria-label={t('bottomNav.mainNav')}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-primary-foreground/10 bg-primary px-3 py-2 pb-safe md:hidden"
        dir={dir}
      >
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
          <Link to="/apply" className="flex h-11 items-center justify-center gap-2 rounded-md bg-brand-strong px-4 text-sm font-bold text-brand-foreground">
            <FileText className="h-4 w-4" />
            {t('bottomNav.apply')}
          </Link>
          <a href={WHATSAPP_PHONE_URL} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-md border border-primary-foreground/25 px-4 text-sm font-bold text-primary-foreground">
            <MessageCircle className="h-4 w-4" />
            {t('bottomNav.whatsapp', 'WhatsApp')}
          </a>
        </div>
      </nav>
    );
  }

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    {
      name: t('bottomNav.home'),
      href: '/',
      icon: Home,
      ariaLabel: t('bottomNav.homeAria')
    },
    {
      name: t('bottomNav.majors'),
      href: '/educational-programs',
      icon: Search,
      ariaLabel: t('bottomNav.majorsAria')
    },
    {
      name: t('bottomNav.advisor'),
      href: '/ai-advisor',
      icon: Bot,
      ariaLabel: t('bottomNav.advisorAria')
    },
    {
      name: t('bottomNav.apply', 'Apply'),
      href: '/apply',
      icon: FileText,
      ariaLabel: t('bottomNav.applyAria', 'Apply Now')
    },
    {
      name: t('bottomNav.account'),
      href: '/student-auth',
      icon: User,
      ariaLabel: t('bottomNav.accountAria')
    }
  ];

  return (
    <nav 
      role="navigation" 
      aria-label={t('bottomNav.mainNav')}
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-2 py-2 pb-safe md:hidden"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))'
      }}
      dir={dir}
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-label={item.ariaLabel}
              className={`bottom-nav-item ${active ? 'active' : ''}`}
            >
              <Icon 
                className={`h-5 w-5 mb-1.5 ${active ? 'stroke-2' : 'stroke-1.5'}`}
                aria-hidden="true"
              />
              <span className={`text-xs font-medium leading-tight truncate max-w-[60px] ${
                active ? 'text-brand-strong' : 'text-muted-foreground'
              }`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
