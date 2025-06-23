
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Book, MessageCircle, User } from 'lucide-react';

const BottomNav = () => {
  const location = useLocation();

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
      name: 'الدورات',
      href: '/educational-destinations',
      icon: Book,
      ariaLabel: 'وجهاتنا التعليمية'
    },
    {
      name: 'الدردشة',
      href: '/contact',
      icon: MessageCircle,
      ariaLabel: 'تواصل معنا'
    },
    {
      name: 'الملف الشخصي',
      href: '/student-auth',
      icon: User,
      ariaLabel: 'الملف الشخصي'
    }
  ];

  return (
    <nav 
      role="navigation" 
      aria-label="التنقل الرئيسي"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-2 pb-safe"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))'
      }}
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
              className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-2 py-1 rounded-lg transition-all duration-200 hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                active 
                  ? 'text-orange-500 bg-orange-50' 
                  : 'text-gray-600 hover:text-orange-500'
              }`}
            >
              <Icon 
                className={`h-5 w-5 mb-1 ${active ? 'stroke-2' : 'stroke-1.5'}`}
                aria-hidden="true"
              />
              <span className={`text-xs font-medium leading-tight ${
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
