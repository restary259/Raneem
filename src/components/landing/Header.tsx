
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DesktopNav from "./DesktopNav";

const Header = () => {
  const { t } = useTranslation();
  const navLinks = [
    { href: "/", label: t('nav.home') },
    { href: "/about", label: t('nav.about') },
    { href: "/locations", label: t('nav.locations') },
    { href: "/testimonials", label: t('nav.testimonials') },
    { href: "/services", label: t('nav.services') },
    { href: "/broadcast", label: t('nav.broadcast') },
    { href: "/partnership", label: t('nav.partnership') },
    { href: "/partners", label: t('nav.partners') },
    { href: "/resources", label: t('nav.resources') },
    { href: "/contact", label: t('nav.contact') },
  ];
  
  const sheetSide = 'right';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center space-x-2">
            <span className="font-extrabold text-xl">{t('nav.brand')}</span>
          </Link>
          <nav className="hidden md:flex">
            <DesktopNav />
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex">
            <Button asChild variant="accent">
              <Link to="/contact">{t('applyNow')}</Link>
            </Button>
          </div>
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={sheetSide}>
                <div className="flex flex-col h-full">
                  <nav className="grid gap-6 text-lg font-medium text-right mt-6">
                    <Link to="/" className="flex items-center gap-2 text-lg font-semibold mb-6 justify-end">
                      <span className="font-extrabold text-xl">{t('nav.brand')}</span>
                    </Link>
                    {navLinks.map((link) => (
                      <Link key={link.href} to={link.href} className="block py-2 text-muted-foreground hover:text-foreground">
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-auto">
                    <Button asChild variant="accent" className="w-full">
                        <Link to="/contact">{t('applyNow')}</Link>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
