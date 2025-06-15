
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import Pricing from "@/components/landing/Pricing";

const PricingPage = () => {
  return (
    <div dir="rtl" className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow">
        <Pricing />
      </main>
      <Footer />
    </div>
  );
};

export default PricingPage;
