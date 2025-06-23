
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
        <div className="flex items-center justify-between h-16" dir="rtl">
          {/* Student Login Button - Right Side */}
          <div className="hidden md:block">
            <Link 
              to="/student-auth" 
              className="bg-orange-500 text-white px-6 py-2 rounded-full font-medium hover:bg-orange-600 transition-colors text-sm"
            >
              تسجيل الدخول للطلاب
            </Link>
          </div>

          {/* Logo - Center */}
          <Link to="/" className="flex items-center gap-2 mx-4">
            <img 
              src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" 
              alt="درب" 
              className="h-10 w-auto object-contain"
            />
            <span className="font-bold text-xl text-gray-900 hidden sm:block">درب</span>
          </Link>

          {/* Desktop Navigation - Left Side */}
          <div className="hidden md:block">
            <DesktopNav />
          </div>

          {/* Mobile Menu - Left Side */}
          <div className="md:hidden flex items-center">
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
