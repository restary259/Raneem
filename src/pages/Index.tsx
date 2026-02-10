
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import AboutCustom from "@/components/landing/AboutCustom";
import WhyChooseUs from "@/components/landing/WhyChooseUs";
import Footer from "@/components/landing/Footer";
import PartnersMarquee from "@/components/landing/PartnersMarquee";
import StudentJourney from "@/components/landing/StudentJourney";
import StudentGallery from "@/components/landing/StudentGallery";
import SEOHead from "@/components/common/SEOHead";
import { useDirection } from "@/hooks/useDirection";
import { useTranslation } from "react-i18next";

const Index = () => {
  const { dir } = useDirection();
  const { t } = useTranslation();
  return (
    <div dir={dir} className="flex flex-col min-h-screen bg-background text-foreground">
      <SEOHead title={t('seo.indexTitle')} description={t('seo.indexDesc')} />
      <Header />
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
