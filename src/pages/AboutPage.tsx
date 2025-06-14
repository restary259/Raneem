
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import About from "@/components/landing/About";

const AboutPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl" lang="ar">
      <Header />
      <main className="flex-grow">
        <About />
      </main>
      <Footer />
    </div>
  );
};

export default AboutPage;
