
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import Services from "@/components/landing/Services";

const ServicesPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl" lang="ar">
      <Header />
      <main className="flex-grow">
        <Services />
      </main>
      <Footer />
    </div>
  );
};

export default ServicesPage;
