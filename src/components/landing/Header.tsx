
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Header = () => {
  const { t } = useTranslation();
  const navLinks = [
    { href: "/", label: t('nav.home') },
    { href: "/about", label: t('nav.about') },
    { href: "/services", label: t('nav.services') },
    { href: "/broadcast", label: "غرفة الأخبار" },
    { href: "/partners", label: t('nav.partners') },
    { href: "/partnership", label: t('nav.partnership') },
    { href: "/resources", label: t('nav.resources') },
    { href: "/contact", label: t('nav.contact') },
  ];
  
  const sheetSide = 'right';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="ml-4 hidden md:flex flex-1">
          <Link to="/" className="ml-6 flex items-center space-x-2">
            <span className="font-extrabold text-xl">{t('nav.brand')}</span>
          </Link>
          <nav className="flex items-center gap-x-6 text-sm font-medium">
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href} className="transition-colors hover:text-foreground/80 text-foreground/60">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-start space-x-2 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side={sheetSide}>
              <div className="flex flex-col h-full">
                <nav className="grid gap-6 text-lg font-medium text-right">
                  <Link to="/" className="flex items-center gap-2 text-lg font-semibold mb-6 justify-end">
                    <span className="font-extrabold text-xl">{t('nav.brand')}</span>
                  </Link>
                  {navLinks.map((link) => (
                    <Link key={link.href} to={link.href} className="block py-2 text-muted-foreground hover:text-foreground">
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex items-center justify-end md:flex-1 space-x-2">
            <div className="hidden md:flex items-center justify-end space-x-4">
                <Button asChild variant="accent">
                    <Link to="/contact">{t('applyNow')}</Link>
                </Button>
            </div>
             <div className="md:hidden">
                <Link to="/" className="flex items-center space-x-2">
                    <span className="font-extrabold text-xl">{t('nav.brand')}</span>
                </Link>
             </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
