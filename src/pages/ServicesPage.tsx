
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import ServicesHero from "@/components/services/ServicesHero";
import ServicesGrid from "@/components/services/ServicesGrid";
import ServiceProcess from "@/components/services/ServiceProcess";
import TestimonialSection from "@/components/services/TestimonialSection";
import ConsultationCta from "@/components/services/ConsultationCta";

const ServicesPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow">
        <ServicesHero />
        <ServicesGrid />
        <ServiceProcess />
        <TestimonialSection />
        <ConsultationCta />
      </main>
      <Footer />
    </div>
  );
};

export default ServicesPage;
