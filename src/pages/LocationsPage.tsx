
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import Locations from "@/components/landing/Locations";
import SEOHead from "@/components/common/SEOHead";
import { useDirection } from "@/hooks/useDirection";
import { useTranslation } from "react-i18next";
import DarbPageHero from "@/components/common/DarbPageHero";
import { DARB_PUBLIC_HERO_IMAGES } from "@/config/publicHeroImages";

const LocationsPage = () => {
  const { dir } = useDirection();
  const { t } = useTranslation();
  return (
    <div dir={dir} className="flex flex-col min-h-screen bg-background text-foreground">
      <SEOHead title={t('seo.locationsTitle')} description={t('seo.locationsDesc')} />
      <Header />
      <main className="flex-grow">
        <DarbPageHero
          imageUrl={DARB_PUBLIC_HERO_IMAGES.city}
          imageAlt={t('locations.imageAlt', 'Bright German city representing DARB destinations')}
          title={t('locations.title')}
          subtitle={t('seo.locationsDesc')}
        />
        <Locations />

      </main>
      <Footer />
    </div>
  );
};

export default LocationsPage;
