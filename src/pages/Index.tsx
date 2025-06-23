
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import AboutCustom from "@/components/landing/AboutCustom";
import WhyChooseUs from "@/components/landing/WhyChooseUs";
import Footer from "@/components/landing/Footer";
import PartnersMarquee from "@/components/landing/PartnersMarquee";
import StudentJourney from "@/components/landing/StudentJourney";
import StudentGallery from "@/components/landing/StudentGallery";
import MobileHomeFeed from "@/components/mobile/MobileHomeFeed";
import HomeFeed from "@/components/feed/HomeFeed";

const Index = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  // Show authenticated home feed for logged-in users
  if (user) {
    return isMobile ? <MobileHomeFeed /> : <HomeFeed />;
  }

  // Show mobile optimized landing for non-authenticated mobile users
  if (isMobile) {
    return <MobileHomeFeed />;
  }

  // Desktop landing page
  return (
    <div dir="rtl" className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-grow">
        <Hero />
        <PartnersMarquee />
        <AboutCustom />
        <StudentJourney />
        <WhyChooseUs />
        <StudentGallery />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
