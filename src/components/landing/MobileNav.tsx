
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface MobileNavProps {
  onClose: () => void;
}

const MobileNav = ({ onClose }: MobileNavProps) => {
  const { t } = useTranslation();

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
    <div className="border-t bg-white p-4">
      <div className="flex flex-col space-y-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={onClose}
            className="text-gray-700 hover:text-orange-600 transition-colors py-2 px-4 rounded-md hover:bg-orange-50 font-medium"
          >
            {item.label}
          </Link>
        ))}
        <Link
          to="/student-auth"
          onClick={onClose}
          className="mt-4"
        >
          <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white">
            تسجيل الدخول للطلاب
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default MobileNav;
