
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import Testimonials from "@/components/landing/Testimonials";

const TestimonialsPage = () => {
  return (
    <div dir="rtl" className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow">
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
};

export default TestimonialsPage;
