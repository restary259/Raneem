
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStudentProfile } from '@/hooks/useStudentProfile';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Menu, 
  Globe, 
  Settings, 
  FileText, 
  Heart, 
  Bell, 
  LogOut, 
  User,
  BookOpen,
  MessageSquare,
  Shield,
  HelpCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const MobileDrawer = () => {
  const { user } = useAuth();
  const { profile } = useStudentProfile(user?.id || '');
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' || lang === 'he' ? 'rtl' : 'ltr';
    setIsOpen(false);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "تم تسجيل الخروج بنجاح",
        description: "نراك قريباً!",
      });
      setIsOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في تسجيل الخروج",
        description: error.message,
      });
    }
  };

  const menuItems = [
    {
      section: 'account',
      items: [
        { icon: User, label: 'تعديل الملف الشخصي', href: '/dashboard/profile' },
        { icon: FileText, label: 'طلباتي', href: '/dashboard' },
        { icon: Heart, label: 'المفضلة', href: '/dashboard/favorites' },
        { icon: Bell, label: 'الإشعارات', href: '/dashboard/notifications' },
      ]
    },
    {
      section: 'community',
      items: [
        { icon: MessageSquare, label: 'المجتمع', href: '/community' },
        { icon: BookOpen, label: 'الموارد', href: '/resources' },
      ]
    },
    {
      section: 'support',
      items: [
        { icon: HelpCircle, label: 'الأسئلة الشائعة', href: '/faq' },
        { icon: Shield, label: 'الخصوصية', href: '/privacy' },
        { icon: FileText, label: 'الشروط والأحكام', href: '/terms' },
      ]
    }
  ];

  const languages = [
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'he', name: 'עברית', flag: '🇮🇱' },
  ];

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="sm" className="p-2">
          <Menu className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]" dir="rtl">
        <DrawerHeader className="text-right">
          <DrawerTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback>
                {profile?.full_name?.charAt(0) || user?.email?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold">{profile?.full_name || 'مستخدم'}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-8 space-y-6 overflow-y-auto">
          {/* Language Selector */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              اللغة
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {languages.map((lang) => (
                <Button
                  key={lang.code}
                  variant={i18n.language === lang.code ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleLanguageChange(lang.code)}
                  className="text-xs"
                >
                  <span className="mr-1">{lang.flag}</span>
                  {lang.name}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Menu Sections */}
          {user && (
            <>
              {menuItems.map((section, sectionIndex) => (
                <div key={section.section}>
                  <div className="space-y-2">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <DrawerClose key={item.href} asChild>
                          <Link
                            to={item.href}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-sm">{item.label}</span>
                          </Link>
                        </DrawerClose>
                      );
                    })}
                  </div>
                  {sectionIndex < menuItems.length - 1 && <Separator />}
                </div>
              ))}

              <Separator />

              {/* Logout */}
              <Button
                variant="destructive"
                onClick={handleLogout}
                className="w-full justify-start"
                size="sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                تسجيل الخروج
              </Button>
            </>
          )}

          {!user && (
            <DrawerClose asChild>
              <Link to="/student-auth">
                <Button className="w-full">
                  تسجيل الدخول
                </Button>
              </Link>
            </DrawerClose>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MobileDrawer;
