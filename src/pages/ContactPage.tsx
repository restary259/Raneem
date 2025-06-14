
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import Contact from "@/components/landing/Contact";
import ContactHero from "@/components/landing/ContactHero";

const ContactPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl" lang="ar">
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
