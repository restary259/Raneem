
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Languages } from '@/components/Languages';

const DesktopNav = () => {
  const { t } = useTranslation();

  const navigationItems = [
    { name: 'الرئيسية', href: '/' },
    { name: 'الخدمات', href: '/services' },
    { name: 'الشركاء', href: '/partners' },
    { name: 'الشراكة', href: '/partnership' },
    { name: 'الموارد', href: '/resources' },
    { name: 'من نحن', href: '/about' },
    { name: 'المجتمع', href: '/community' },
    { name: 'تواصل معنا', href: '/contact' },
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Languages />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-white shadow-lg border" align="end">
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
