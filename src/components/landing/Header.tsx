
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Link } from "react-router-dom";

const Header = () => {
  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About Us" },
    { href: "/services", label: "Services" },
    { href: "/partners", label: "Partners" },
    { href: "/partnership", label: "Partnership" },
    { href: "/resources", label: "Resources" },
    { href: "/contact", label: "Contact Us" },
  ];
  
  const sheetSide = 'left';

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex flex-1">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <span className="font-extrabold text-xl">Darb</span>
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
                <nav className="grid gap-6 text-lg font-medium">
                  <Link to="/" className="flex items-center gap-2 text-lg font-semibold mb-6">
                    <span className="font-extrabold text-xl">Darb</span>
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
                    <Link to="/contact">Apply Now</Link>
                </Button>
            </div>
             <div className="md:hidden">
                <Link to="/" className="flex items-center space-x-2">
                    <span className="font-extrabold text-xl">Darb</span>
                </Link>
             </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
