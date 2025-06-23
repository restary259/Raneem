
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, MessageCircle, User } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const BottomNav = () => {
  const location = useLocation();
  const isMobile = useIsMobile();

  // Only show on mobile devices
  if (!isMobile) {
    return null;
  }

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    {
      name: 'الرئيسية',
      href: '/',
      icon: Home,
      ariaLabel: 'الصفحة الرئيسية'
    },
    {
      name: 'التخصصات',
      href: '/educational-programs',
      icon: Search,
      ariaLabel: 'البحث في التخصصات'
    },
    {
      name: 'اتصل بنا',
      href: '/contact',
      icon: MessageCircle,
      ariaLabel: 'تواصل معنا'
    },
    {
      name: 'الملف الشخصي',
      href: '/student-auth',
      icon: User,
      ariaLabel: 'الملف الشخصي للطالب'
    }
  ];

  return (
    <nav 
      role="navigation" 
      aria-label="التنقل الرئيسي"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-2 py-1 pb-safe md:hidden"
      style={{
        paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))'
      }}
      dir="rtl"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.name}
              to={item.href}
              aria-label={item.ariaLabel}
              className={`bottom-nav-item ${active ? 'active' : ''}`}
            >
              <Icon 
                className={`h-4 w-4 mb-1 ${active ? 'stroke-2' : 'stroke-1.5'}`}
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
