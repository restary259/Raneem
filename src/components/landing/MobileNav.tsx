
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

const MobileNav = () => {
  const { t } = useTranslation();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <nav className="flex flex-col gap-4 mt-8">
          <Link 
            to="/" 
            className="text-lg font-medium hover:text-orange-500 transition-colors"
          >
            {t('nav.home')}
          </Link>
          <Link 
            to="/about" 
            className="text-lg font-medium hover:text-orange-500 transition-colors"
          >
            {t('nav.about')}
          </Link>
          <Link 
            to="/services" 
            className="text-lg font-medium hover:text-orange-500 transition-colors"
          >
            {t('nav.services')}
          </Link>
          <Link 
            to="/broadcast" 
            className="text-lg font-medium hover:text-orange-500 transition-colors"
          >
            {t('nav.broadcast')}
          </Link>
          <Link 
            to="/partnership" 
            className="text-lg font-medium hover:text-orange-500 transition-colors"
          >
            {t('nav.partnership')}
          </Link>
          <Link 
            to="/partners" 
            className="text-lg font-medium hover:text-orange-500 transition-colors"
          >
            وجهاتنا التعليمية
          </Link>
          <Link 
            to="/quiz" 
            className="text-lg font-medium hover:text-orange-500 transition-colors"
          >
            اختبار التخصص
          </Link>
          <Link 
            to="/resources" 
            className="text-lg font-medium hover:text-orange-500 transition-colors"
          >
            {t('nav.resources')}
          </Link>
          <Link 
            to="/contact" 
            className="text-lg font-medium hover:text-orange-500 transition-colors"
          >
            {t('nav.contact')}
          </Link>
          <Link 
            to="/student-auth" 
            className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors text-center"
          >
            تسجيل الدخول للطلاب
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
