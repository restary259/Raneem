import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import ServicesHero from "@/components/services/ServicesHero";
import ServicesGrid from "@/components/services/ServicesGrid";
import ServiceProcess from "@/components/services/ServiceProcess";
import ServiceDisclosure from "@/components/services/ServiceDisclosure";
import DarbContactCta from "@/components/common/DarbContactCta";
import SEOHead from "@/components/common/SEOHead";
import { useDirection } from "@/hooks/useDirection";
import { useTranslation } from "react-i18next";

const ServicesPage = () => {
  const { dir } = useDirection();
  const { t: tc } = useTranslation("common");

  // Service + BreadcrumbList structured data is emitted server-side by the
  // /services route head() so crawlers that do not run JavaScript see it.

  return (
    <div
      dir={dir}
      className="flex flex-col min-h-screen bg-background text-foreground"
    >
      <SEOHead
        title={tc("seo.servicesTitle")}
        description={tc("seo.servicesDesc")}
      />
      <Header />
      <main className="flex-grow">
        <ServicesHero />
        <ServicesGrid />
        <ServiceProcess />
        <ServiceDisclosure />
        <DarbContactCta />
      </main>
      <Footer />
    </div>
  );
};

export default ServicesPage;
