
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import AboutCustom from "@/components/landing/AboutCustom";
import WhyChooseUs from "@/components/landing/WhyChooseUs";
import Footer from "@/components/landing/Footer";
import PartnersMarquee from "@/components/landing/PartnersMarquee";
import StudentJourney from "@/components/landing/StudentJourney";
import StudentGallery from "@/components/landing/StudentGallery";
import { useDirection } from "@/hooks/useDirection";

const Index = () => {
  const { dir } = useDirection();
  return (
    <div dir={dir} className="flex flex-col min-h-screen bg-background text-foreground">
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
