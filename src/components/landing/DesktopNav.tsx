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
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  const navigationItems = [
    { name: t('nav.home'), href: '/' },
    { name: t('nav.services'), href: '/services' },
    { name: t('nav.partners'), href: '/partners' },
    { name: t('nav.partnership'), href: '/partnership' },
    { name: t('nav.resources'), href: '/resources' },
    { name: t('nav.about'), href: '/about' },
    { name: 'المجتمع', href: '/community' }, // Added community link
    { name: t('nav.contact'), href: '/contact' },
  ];

  return (
    <nav className="hidden lg:flex items-center space-x-6">
      {navigationItems.map((item) => (
        <Link key={item.name} to={item.href} className="text-sm font-medium text-gray-800 hover:text-gray-900">
          {item.name}
        </Link>
      ))}
      {isAuthenticated ? (
        <Link to="/dashboard">
          <Button variant="default" size="sm">
            {t('nav.dashboard')}
          </Button>
        </Link>
      ) : (
        <>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                {t('nav.login')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t('nav.login')}</DialogTitle>
                <DialogDescription>
                  {t('login.choose')}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Button onClick={() => window.location.href = '/auth/login/email'} variant="outline" size="sm">{t('login.email')}</Button>
                <Button onClick={() => window.location.href = '/auth/login/google'} variant="outline" size="sm">{t('login.google')}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Link to="/auth/register">
            <Button variant="default" size="sm">
              {t('nav.register')}
            </Button>
          </Link>
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            <Languages />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Change language</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => localStorage.setItem('i18nextLng', 'ar')}>
            Arabic
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => localStorage.setItem('i18nextLng', 'en')}>
            English
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => localStorage.setItem('i18nextLng', 'fr')}>
            French
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
};

export default DesktopNav;
