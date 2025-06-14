
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Link } from "react-router-dom";

const navLinks = [
  { href: "#about", label: "About Us" },
  { href: "#services", label: "Services" },
  { href: "#locations", label: "Where We Work" },
  { href: "#testimonials", label: "Success Stories" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
];

const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">Darb Study</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="transition-colors hover:text-foreground/80 text-foreground/60">
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <nav className="grid gap-6 text-lg font-medium">
                <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
                  <span className="font-bold">Darb Study</span>
                </Link>
                {navLinks.map((link) => (
                  <a key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
                    {link.label}
                  </a>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
        <div className="hidden md:flex items-center justify-end space-x-2">
             <Button asChild>
                <a href="#contact">Apply Now</a>
             </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
