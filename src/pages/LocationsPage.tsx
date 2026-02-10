
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import Locations from "@/components/landing/Locations";
import SEOHead from "@/components/common/SEOHead";
import { useDirection } from "@/hooks/useDirection";
import { useTranslation } from "react-i18next";

const LocationsPage = () => {
  const { dir } = useDirection();
  const { t } = useTranslation();
  return (
    <div dir={dir} className="flex flex-col min-h-screen bg-background text-foreground">
      <SEOHead title={t('seo.locationsTitle')} description={t('seo.locationsDesc')} />
      <Header />
      <main className="flex-grow">
        <Locations />
      </main>
      <Footer />
    </div>
  );
};

export default LocationsPage;
