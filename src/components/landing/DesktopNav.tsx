
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

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
    { href: '/quiz', label: 'اختبار التخصص' },
    { href: '/partnership', label: 'شراكة' },
    { href: '/broadcast', label: 'البث المباشر' },
  ];

  return (
    <nav className="flex items-center space-x-8">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="text-foreground hover:text-primary transition-colors font-medium">
            القائمة
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 bg-background border shadow-lg">
          {navItems.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                to={item.href}
                className="text-foreground hover:text-primary transition-colors font-medium cursor-pointer"
              >
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Link to="/student-auth">
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
          تسجيل الدخول للطلاب
        </Button>
      </Link>
    </nav>
  );
};

export default DesktopNav;
