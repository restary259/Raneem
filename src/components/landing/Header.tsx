
import React, { useState, useEffect } from "react";
import { Menu, X, ChevronDown, User, LogOut } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    
    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const navigation = [
    { name: t('nav.home'), href: '/' },
    { name: t('nav.about'), href: '/about' },
    { name: t('nav.services'), href: '/services' },
    { name: t('nav.partners'), href: '/partners' },
    { name: t('nav.resources'), href: '/resources' },
    { name: t('nav.locations'), href: '/locations' },
    { name: t('nav.contact'), href: '/contact' },
  ];

  const secondaryNavigation = [
    { name: t('nav.partnership'), href: '/partnership' },
    { name: t('nav.broadcast'), href: '/broadcast' },
  ];

  const handleStudentPortal = () => {
    if (user) {
      navigate('/student-dashboard');
    } else {
      navigate('/student-auth');
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const MobileNavLink = ({ item }: { item: { name: string; href: string } }) => (
    <Link
      to={item.href}
      className={`block px-3 py-2 text-base font-medium transition-colors rounded-md ${
        isActive(item.href)
          ? 'text-primary bg-primary/10'
          : 'text-gray-700 hover:text-primary hover:bg-gray-50'
      }`}
      onClick={() => setIsOpen(false)}
    >
      {item.name}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 space-x-reverse">
            <div className="text-2xl font-bold text-primary">درب</div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6 space-x-reverse">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive(item.href) ? 'text-primary' : 'text-gray-700'
                }`}
              >
                {item.name}
              </Link>
            ))}
            
            {/* More dropdown for secondary items */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  المزيد
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {secondaryNavigation.map((item) => (
                  <DropdownMenuItem key={item.name} asChild>
                    <Link to={item.href} className="w-full">
                      {item.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* User Actions */}
          <div className="hidden md:flex items-center space-x-4 space-x-reverse">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    مرحباً
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/student-dashboard')}>
                    <User className="h-4 w-4 ml-2" />
                    لوحة التحكم
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 ml-2" />
                    تسجيل الخروج
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={handleStudentPortal}
                variant="default"
                size="sm"
                className="bg-primary hover:bg-primary/90"
              >
                {t('nav.studentPortal')}
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="فتح القائمة"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <div className="flex flex-col space-y-4 mt-8">
                {/* Mobile Navigation Links */}
                <div className="space-y-2">
                  {navigation.map((item) => (
                    <MobileNavLink key={item.name} item={item} />
                  ))}
                  
                  {/* Secondary navigation in mobile */}
                  <div className="pt-4 border-t">
                    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      خدمات إضافية
                    </h3>
                    {secondaryNavigation.map((item) => (
                      <MobileNavLink key={item.name} item={item} />
                    ))}
                  </div>
                </div>

                {/* Mobile User Actions */}
                <div className="pt-4 border-t space-y-2">
                  {user ? (
                    <>
                      <Button
                        onClick={() => {
                          navigate('/student-dashboard');
                          setIsOpen(false);
                        }}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <User className="h-4 w-4 ml-2" />
                        لوحة التحكم
                      </Button>
                      <Button
                        onClick={() => {
                          handleSignOut();
                          setIsOpen(false);
                        }}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <LogOut className="h-4 w-4 ml-2" />
                        تسجيل الخروج
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => {
                        handleStudentPortal();
                        setIsOpen(false);
                      }}
                      className="w-full"
                    >
                      {t('nav.studentPortal')}
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;
