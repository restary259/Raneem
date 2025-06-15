
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import About from "@/components/landing/About";
import WhyChooseUs from "@/components/landing/WhyChooseUs";
import Footer from "@/components/landing/Footer";
import GpaCalculator from "@/components/calculator/GpaCalculator";

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl" lang="ar">
      <Header />
      <main className="flex-grow">
        <Hero />
        <About />
        <WhyChooseUs />
        <GpaCalculator />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
