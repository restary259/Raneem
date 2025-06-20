
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const DesktopNav = () => {
  const { t } = useTranslation();

  const navItems = [
    { href: '/about', label: 'من نحن' },
    { href: '/services', label: 'خدماتنا' },
    { href: '/partners', label: 'شركاؤنا' },
    { href: '/locations', label: 'مواقعنا' },
    { href: '/resources', label: 'الموارد' },
    { href: '/blog', label: 'المدونة' },
    { href: '/contact', label: 'اتصل بنا' },
  ];

  return (
    <nav className="flex items-center space-x-8">
      {navItems.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          className="text-foreground hover:text-primary transition-colors font-medium"
        >
          {item.label}
        </Link>
      ))}
      <Link to="/student-auth">
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
          تسجيل الدخول للطلاب
        </Button>
      </Link>
    </nav>
  );
};

export default DesktopNav;
