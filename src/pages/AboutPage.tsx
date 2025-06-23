
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import AboutCustom from "@/components/landing/AboutCustom";

const AboutPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl">
      <Header />
      <main className="flex-grow">
        <AboutCustom />
      </main>
      <Footer />
    </div>
  );
};

export default AboutPage;
