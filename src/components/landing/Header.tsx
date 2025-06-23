
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
        <div className="flex items-center justify-between h-16">
          {/* Logo - Right Side (RTL) */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3">
              <img 
                src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" 
                alt="درب" 
                className="h-10 w-auto object-contain"
              />
              <span className="font-bold text-xl text-gray-900 whitespace-nowrap">
                درب
              </span>
            </Link>
          </div>

          {/* Desktop Navigation - Center */}
          <div className="hidden lg:flex flex-1 justify-center mx-8">
            <DesktopNav />
          </div>

          {/* Student Portal Button - Left Side (Desktop only) */}
          <div className="hidden lg:block">
            <Link 
              to="/student-auth" 
              className="bg-orange-500 text-white px-5 py-2.5 rounded-full font-medium hover:bg-orange-600 transition-colors text-base whitespace-nowrap"
            >
              البوابة الطلابية
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
