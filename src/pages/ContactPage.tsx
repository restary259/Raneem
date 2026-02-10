
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import Contact from "@/components/landing/Contact";
import ContactHero from "@/components/landing/ContactHero";
import SEOHead from "@/components/common/SEOHead";
import { useDirection } from "@/hooks/useDirection";
import { useTranslation } from "react-i18next";

const ContactPage = () => {
  const { dir } = useDirection();
  const { t } = useTranslation();
  return (
    <div dir={dir} className="flex flex-col min-h-screen bg-background text-foreground">
      <SEOHead title={t('seo.contactTitle')} description={t('seo.contactDesc')} />
      <Header />
      <main className="flex-grow">
        <ContactHero />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default ContactPage;
