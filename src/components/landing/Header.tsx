
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Link } from "react-router-dom";

const navLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/about", label: "من نحن" },
  { href: "/services", label: "خدماتنا" },
  { href: "/partners", label: "شركاؤنا" },
  { href: "/partnership", label: "فرص الشراكة" },
  { href: "/contact", label: "تواصل معنا" },
];

const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="ml-4 hidden md:flex">
          <Link to="/" className="ml-6 flex items-center space-x-2">
            <span className="font-extrabold text-xl">درب</span>
          </Link>
          <nav className="flex items-center gap-x-6 text-sm font-medium">
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href} className="transition-colors hover:text-foreground/80 text-foreground/60">
                {link.label}
              </Link>
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
            <SheetContent side="right">
              <nav className="grid gap-6 text-lg font-medium text-right">
                <Link to="/" className="flex items-center justify-end gap-2 text-lg font-semibold">
                  <span className="font-extrabold text-xl">درب</span>
                </Link>
                {navLinks.map((link) => (
                  <Link key={link.href} to={link.href} className="text-muted-foreground hover:text-foreground">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex items-center space-x-2 md:hidden">
            <span className="font-extrabold text-xl">درب</span>
          </Link>
        </div>
        <div className="hidden md:flex items-center justify-end space-x-2">
             <Button asChild variant="accent">
                <Link to="/contact">قدم الآن</Link>
             </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
