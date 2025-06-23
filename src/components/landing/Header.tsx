
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DesktopNav from './DesktopNav';
import MobileNav from './MobileNav';

const Header = () => {
  const { t } = useTranslation();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm" dir="rtl">
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-12 md:h-14">
          {/* Right Side: Logo only */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-1">
              <img 
                src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" 
                alt="درب" 
                className="h-6 md:h-8 w-auto object-contain"
              />
              <span className="font-bold text-sm md:text-lg text-gray-900 hidden sm:block">درب</span>
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <div className="hidden md:block flex-1 mr-4">
            <DesktopNav />
          </div>

          {/* Left Side: Student Login Button */}
          <div className="hidden md:block">
            <Link 
              to="/student-auth" 
              className="bg-orange-500 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-full font-medium hover:bg-orange-600 transition-colors text-xs md:text-sm whitespace-nowrap"
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
