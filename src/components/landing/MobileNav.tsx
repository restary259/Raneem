
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
        <nav className="flex flex-col gap-3 mt-6">
          <Link 
            to="/" 
            className="text-sm font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            {t('nav.home')}
          </Link>
          <Link 
            to="/about" 
            className="text-sm font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            {t('nav.about')}
          </Link>
          <Link 
            to="/services" 
            className="text-sm font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            {t('nav.services')}
          </Link>
          <Link 
            to="/educational-programs" 
            className="text-sm font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            التخصصات
          </Link>
          <Link 
            to="/quiz" 
            className="text-sm font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            اختيار التخصص
          </Link>
          <Link 
            to="/resources" 
            className="text-sm font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            {t('nav.resources')}
          </Link>
          <Link 
            to="/contact" 
            className="text-sm font-medium hover:text-orange-500 transition-colors text-right py-2"
          >
            {t('nav.contact')}
          </Link>
          
          {/* المزيد section */}
          <div className="border-t pt-3 mt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2 text-right">المزيد</p>
            <Link 
              to="/educational-destinations" 
              className="text-sm font-medium hover:text-orange-500 transition-colors text-right block mb-2 py-2"
            >
              وجهاتنا التعليمية
            </Link>
            <Link 
              to="/partnership" 
              className="text-sm font-medium hover:text-orange-500 transition-colors text-right block mb-2 py-2"
            >
              {t('nav.partnership')}
            </Link>
            <Link 
              to="/broadcast" 
              className="text-sm font-medium hover:text-orange-500 transition-colors text-right block mb-3 py-2"
            >
              {t('nav.broadcast')}
            </Link>
          </div>
          
          <Link 
            to="/student-auth" 
            className="bg-orange-500 text-white px-3 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors text-center mt-3 text-sm"
          >
            تسجيل الدخول للطلاب
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
