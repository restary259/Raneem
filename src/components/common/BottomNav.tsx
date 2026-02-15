
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Bot, User, FileText } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

const BottomNav = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { dir } = useDirection();

  // Hide on influencer apply flow and dashboard pages
  const searchParams = new URLSearchParams(location.search);
  const isInfluencerApply = location.pathname === '/apply' && searchParams.has('ref');
  const isDashboard = ['/student-dashboard', '/admin', '/influencer-dashboard', '/team-dashboard', '/lawyer-dashboard'].includes(location.pathname);

  if (!isMobile || isInfluencerApply || isDashboard) {
    return null;
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
                active ? 'text-orange-500' : 'text-gray-600'
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
