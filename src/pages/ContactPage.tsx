
import Footer from "@/components/landing/Footer";
import Contact from "@/components/landing/Contact";
import ContactHero from "@/components/landing/ContactHero";
import { useIsMobile } from "@/hooks/use-mobile";

const ContactPage = () => {
  const isMobile = useIsMobile();
  
  return (
    <div dir="rtl" className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header is handled by MobileLayout */}
      <main className="flex-grow">
        <ContactHero />
        <Contact />
      </main>
      {!isMobile && <Footer />}
    </div>
  );
};

export default ContactPage;
