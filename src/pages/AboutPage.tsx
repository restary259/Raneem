
import Footer from "@/components/landing/Footer";
import AboutCustom from "@/components/landing/AboutCustom";
import { useIsMobile } from "@/hooks/use-mobile";

const AboutPage = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl">
      {/* Header is handled by MobileLayout */}
      <main className="flex-grow">
        <AboutCustom />
      </main>
      {!isMobile && <Footer />}
    </div>
  );
};

export default AboutPage;
