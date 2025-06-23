
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, GraduationCap, MessageCircle, User, Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

const MobileTabBar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user?.id || '', { limit: 50 });

  const tabs = [
    {
      id: 'home',
      name: 'الرئيسية',
      icon: Home,
      href: '/',
      ariaLabel: 'الصفحة الرئيسية'
    },
    {
      id: 'majors',
      name: 'التخصصات',
      icon: GraduationCap,
      href: '/educational-programs',
      ariaLabel: 'التخصصات والبرامج التعليمية'
    },
    {
      id: 'contact',
      name: 'تواصل',
      icon: MessageCircle,
      href: '/contact',
      ariaLabel: 'تواصل معنا'
    },
    {
      id: 'profile',
      name: 'الملف الشخصي',
      icon: User,
      href: user ? '/dashboard' : '/student-auth',
      ariaLabel: 'الملف الشخصي'
    }
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-2 py-1 safe-area-bottom"
      role="navigation"
      aria-label="التنقل الرئيسي"
      dir="rtl"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          
          return (
            <Link
              key={tab.id}
              to={tab.href}
              aria-label={tab.ariaLabel}
              className={`bottom-nav-item relative ${active ? 'active' : ''}`}
            >
              <div className="relative">
                <Icon 
                  className={`h-5 w-5 mb-1 ${active ? 'stroke-2' : 'stroke-1.5'}`}
                  aria-hidden="true"
                />
                {tab.id === 'profile' && user && unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center text-xs p-0 min-w-[16px]"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium leading-tight truncate max-w-[60px]">
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileTabBar;
