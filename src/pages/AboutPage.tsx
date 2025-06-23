
import Footer from "@/components/landing/Footer";
import AboutCustom from "@/components/landing/AboutCustom";
import StoryDiagram from "@/components/about/StoryDiagram";
import { useIsMobile } from "@/hooks/use-mobile";

const AboutPage = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl">
      {/* Header is handled by MobileLayout */}
      <main className="flex-grow">
        <AboutCustom />
        <StoryDiagram />
      </main>
      {!isMobile && <Footer />}
    </div>
  );
};

export default AboutPage;
