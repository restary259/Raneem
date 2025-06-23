
import Footer from "@/components/landing/Footer";
import ServicesHero from "@/components/services/ServicesHero";
import ServicesGrid from "@/components/services/ServicesGrid";
import ServiceProcess from "@/components/services/ServiceProcess";
import TestimonialSection from "@/components/services/TestimonialSection";
import ConsultationCta from "@/components/services/ConsultationCta";
import { useIsMobile } from "@/hooks/use-mobile";

const ServicesPage = () => {
  const isMobile = useIsMobile();
  
  return (
    <div dir="rtl" className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header is handled by MobileLayout for mobile, only show on desktop */}
      <main className="flex-grow">
        <ServicesHero />
        <ServicesGrid />
        <ServiceProcess />
        <TestimonialSection />
        <ConsultationCta />
      </main>
      {!isMobile && <Footer />}
    </div>
  );
};

export default ServicesPage;
