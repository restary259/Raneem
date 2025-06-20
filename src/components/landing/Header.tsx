
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MobileNav from './MobileNav';

const Header = () => {
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const navItems = [
    { href: '/about', label: 'من نحن' },
    { href: '/services', label: 'خدماتنا' },
    { href: '/partners', label: 'شركاؤنا' },
    { href: '/locations', label: 'مواقعنا' },
    { href: '/resources', label: 'الموارد' },
    { href: '/blog', label: 'المدونة' },
    { href: '/contact', label: 'اتصل بنا' },
    { href: '/quiz', label: 'اختبار التخصص' },
    { href: '/partnership', label: 'شراكة' },
    { href: '/broadcast', label: 'البث المباشر' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <div className="flex items-center">
            <span className="text-2xl font-bold text-orange-600">درب</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <nav className="flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="text-gray-700 hover:text-orange-600 transition-colors font-medium px-3 py-2 rounded-md hover:bg-orange-50"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          
          <Link to="/student-auth">
            <Button className="bg-orange-600 hover:bg-orange-700 text-white">
              تسجيل الدخول للطلاب
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMobileMenu}
            className="h-9 w-9"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <MobileNav onClose={() => setIsMobileMenuOpen(false)} />
        </div>
      )}
    </header>
  );
};

export default Header;
