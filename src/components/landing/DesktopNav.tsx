
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Languages } from '@/components/Languages';
import { useAuth } from '@/hooks/useAuth';

interface DesktopNavProps {
  t: any;
}

const DesktopNav = ({ t }: DesktopNavProps) => {
  const { t: translate } = useTranslation();
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  const navigationItems = [
    { name: t('nav.home'), href: '/' },
    { name: t('nav.services'), href: '/services' },
    { name: t('nav.partners'), href: '/partners' },
    { name: t('nav.partnership'), href: '/partnership' },
    { name: t('nav.resources'), href: '/resources' },
    { name: t('nav.about'), href: '/about' },
    { name: 'المجتمع', href: '/community' },
    { name: t('nav.contact'), href: '/contact' },
  ];

  return (
    <nav className="flex items-center space-x-6 space-x-reverse">
      {navigationItems.map((item) => (
        <Link 
          key={item.name} 
          to={item.href} 
          className="text-sm font-medium text-gray-800 hover:text-orange-500 transition-colors px-3 py-2 rounded-md whitespace-nowrap"
        >
          {item.name}
        </Link>
      ))}
      
      <div className="flex items-center space-x-3 space-x-reverse mr-6">
        {isAuthenticated ? (
          <Link to="/dashboard">
            <Button variant="default" size="sm">
              لوحة التحكم
            </Button>
          </Link>
        ) : (
          <>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  تسجيل الدخول
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>تسجيل الدخول</DialogTitle>
                  <DialogDescription>
                    اختر طريقة تسجيل الدخول
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Button onClick={() => window.location.href = '/student-auth'} variant="outline" size="sm">تسجيل الدخول بالإيميل</Button>
                  <Button onClick={() => window.location.href = '/student-auth'} variant="outline" size="sm">تسجيل الدخول بجوجل</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Link to="/student-auth">
              <Button variant="default" size="sm">
                إنشاء حساب
              </Button>
            </Link>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Languages />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel>تغيير اللغة</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              localStorage.setItem('i18nextLng', 'ar');
              window.location.reload();
            }}>
              العربية
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              localStorage.setItem('i18nextLng', 'en');
              window.location.reload();
            }}>
              English
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              localStorage.setItem('i18nextLng', 'he');
              window.location.reload();
            }}>
              עברית
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};

export default DesktopNav;
