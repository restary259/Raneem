
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
              src="/lovable-uploads/ee2b2c88-802e-46b6-b05d-d5ca8c1fd509.png" 
              alt="درب" 
              className="h-10 w-auto object-contain"
            />
            <span className="font-bold text-xl text-gray-900 hidden sm:block">درب</span>
          </Link>

          {/* Mobile Menu - Left Side with proper spacing */}
          <div className="md:hidden flex items-center gap-4">
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
