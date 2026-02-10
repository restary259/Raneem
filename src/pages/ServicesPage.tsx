
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import ServicesHero from "@/components/services/ServicesHero";
import ServicesGrid from "@/components/services/ServicesGrid";
import ServiceProcess from "@/components/services/ServiceProcess";
import TestimonialSection from "@/components/services/TestimonialSection";
import ConsultationCta from "@/components/services/ConsultationCta";
import SEOHead from "@/components/common/SEOHead";
import { useDirection } from "@/hooks/useDirection";
import { useTranslation } from "react-i18next";

const ServicesPage = () => {
  const { dir } = useDirection();
  const { t } = useTranslation();
  return (
    <div dir={dir} className="flex flex-col min-h-screen bg-background text-foreground">
      <SEOHead title={t('seo.servicesTitle')} description={t('seo.servicesDesc')} />
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
