
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import ServicesHero from "@/components/services/ServicesHero";
import ServicesGrid from "@/components/services/ServicesGrid";
import ServiceProcess from "@/components/services/ServiceProcess";
import TestimonialSection from "@/components/services/TestimonialSection";
import ConsultationCta from "@/components/services/ConsultationCta";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import GpaCalculator from "@/components/calculator/GpaCalculator";
import { Calculator } from "lucide-react";

const ServicesPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl" lang="ar">
      <Header />
      <main className="flex-grow">
        <ServicesHero />
        <ServicesGrid />

        <section className="py-12 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-primary">أدوات لمساعدتك</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                استخدم حاسبة المعدل الخاصة بنا لمعرفة فرص قبولك في الجامعات الألمانية.
              </p>
            </div>
            <div className="max-w-4xl mx-auto">
              <Accordion type="single" collapsible className="w-full bg-card p-4 rounded-lg shadow-md">
                <AccordionItem value="gpa-calculator" className="border-b-0">
                  <AccordionTrigger className="text-xl font-bold hover:no-underline p-4">
                    <div className="flex items-center gap-3">
                      <Calculator className="h-6 w-6 text-primary" />
                      <span>حاسبة المعدل بالنظام الألماني</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 pt-2">
                    <GpaCalculator />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </section>

        <ServiceProcess />
        <TestimonialSection />
        <ConsultationCta />
      </main>
      <Footer />
    </div>
  );
};

export default ServicesPage;
