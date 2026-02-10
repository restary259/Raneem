
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DesktopNav from './DesktopNav';
import MobileNav from './MobileNav';

const Header = () => {
  const { t } = useTranslation();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Right Side: Enhanced Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" 
                alt="درب" 
                className="h-8 md:h-10 w-auto object-contain"
              />
              <span className="font-bold text-lg md:text-xl text-gray-900 hidden sm:block">درب</span>
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <div className="hidden md:block flex-1 mr-6">
            <DesktopNav />
          </div>

          {/* Left Side: Enhanced Student Login Button */}
          <div className="hidden md:block">
            <Link 
              to="/student-auth" 
              className="bg-orange-500 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-full font-medium hover:bg-orange-600 transition-colors text-sm md:text-base whitespace-nowrap"
            >
              تسجيل الدخول للطلاب
            </Link>
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
