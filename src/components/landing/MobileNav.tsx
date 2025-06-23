
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
        <Button variant="ghost" size="sm" className="p-2">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72" dir="rtl">
        <nav className="flex flex-col gap-4 mt-8">
          <Link 
            to="/" 
            className="text-base font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            {t('nav.home')}
          </Link>
          <Link 
            to="/about" 
            className="text-base font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            {t('nav.about')}
          </Link>
          <Link 
            to="/services" 
            className="text-base font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            {t('nav.services')}
          </Link>
          <Link 
            to="/educational-programs" 
            className="text-base font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            التخصصات
          </Link>
          <Link 
            to="/quiz" 
            className="text-base font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            اختيار التخصص
          </Link>
          <Link 
            to="/resources" 
            className="text-base font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            {t('nav.resources')}
          </Link>
          <Link 
            to="/contact" 
            className="text-base font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            {t('nav.contact')}
          </Link>
          
          {/* المزيد section - at bottom */}
          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-semibold text-gray-500 mb-3 text-right">المزيد</p>
            <Link 
              to="/educational-destinations" 
              className="text-base font-medium hover:text-orange-500 transition-colors text-right block mb-3 py-2"
            >
              وجهاتنا التعليمية
            </Link>
            <Link 
              to="/partnership" 
              className="text-base font-medium hover:text-orange-500 transition-colors text-right block mb-3 py-2"
            >
              {t('nav.partnership')}
            </Link>
            <Link 
              to="/broadcast" 
              className="text-base font-medium hover:text-orange-500 transition-colors text-right block mb-4 py-2"
            >
              {t('nav.broadcast')}
            </Link>
          </div>
          
          <Link 
            to="/student-auth" 
            className="bg-orange-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors text-center mt-4"
          >
            {t('auth.studentLogin')}
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
