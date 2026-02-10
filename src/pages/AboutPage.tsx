
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import About from "@/components/landing/About";
import SEOHead from "@/components/common/SEOHead";
import { useTranslation } from "react-i18next";

const AboutPage = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <SEOHead title={t('seo.aboutTitle')} description={t('seo.aboutDesc')} />
      <Header />
      <main className="flex-grow">
        <About />
      </main>
      <Footer />
    </div>
  );
};

export default AboutPage;
