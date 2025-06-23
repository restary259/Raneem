
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DesktopNav from './DesktopNav';
import MobileNav from './MobileNav';

const Header = () => {
  const { t } = useTranslation();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Desktop Navigation - Right Side */}
          <div className="hidden md:block">
            <DesktopNav />
          </div>

          {/* Logo - Center */}
          <Link to="/" className="flex items-center gap-2 mx-4">
            <img 
              src="/lovable-uploads/efe8829d-07b5-4776-a49f-c111a5219b76.png" 
              alt="درب" 
              className="h-10 w-auto object-contain"
            />
            <span className="font-bold text-2xl text-gray-900 hidden sm:block">درب</span>
          </Link>

          {/* Mobile Menu - Left Side */}
          <div className="md:hidden">
            <MobileNav />
          </div>

          {/* Student Login Button - Left Side Desktop */}
          <div className="hidden md:block">
            <Link 
              to="/student-auth" 
              className="bg-orange-500 text-white px-6 py-2 rounded-full font-medium hover:bg-orange-600 transition-colors text-sm"
            >
              تسجيل الدخول للطلاب
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
