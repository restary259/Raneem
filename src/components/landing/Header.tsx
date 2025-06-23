
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DesktopNav from './DesktopNav';
import MobileNav from './MobileNav';

const Header = () => {
  const { t } = useTranslation();

  return (
    <header className="bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="hidden md:block">
            <DesktopNav />
          </div>

          <Link to="/" className="flex items-center gap-2">
            <img 
              src="/lovable-uploads/efe8829d-07b5-4776-a49f-c111a5219b76.png" 
              alt="درب" 
              className="h-8 w-auto object-contain"
            />
            <span className="font-bold text-xl">درب</span>
          </Link>

          <div className="md:hidden">
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
