
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import Contact from "@/components/landing/Contact";

const ContactPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl" lang="ar">
      <Header />
      <main className="flex-grow">
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default ContactPage;
