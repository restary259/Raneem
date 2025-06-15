
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import About from "@/components/landing/About";
import WhyChooseUs from "@/components/landing/WhyChooseUs";
import Footer from "@/components/landing/Footer";
import PartnersMarquee from "@/components/landing/PartnersMarquee";
import StudentJourney from "@/components/landing/StudentJourney";
import StudentGallery from "@/components/landing/StudentGallery";

const Index = () => {
  return (
    <div dir="rtl" className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow">
        <Hero />
        <PartnersMarquee />
        <About />
        <StudentJourney />
        <WhyChooseUs />
        <StudentGallery />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
