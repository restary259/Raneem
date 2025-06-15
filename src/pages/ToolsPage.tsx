
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import GpaCalculator from "@/components/calculator/GpaCalculator";
import { Calculator } from "lucide-react";

const ToolsPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground" dir="rtl" lang="ar">
      <Header />
      <main className="flex-grow">
        <section className="bg-secondary/30 py-20">
            <div className="container mx-auto px-4 text-center">
                <h1 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tight">
                    الأدوات
                </h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                    استخدم أدواتنا المفيدة لمساعدتك في التخطيط لرحلتك الدراسية إلى ألمانيا.
                </p>
            </div>
        </section>
        
        <section className="container mx-auto px-4 py-16">
            <div className="max-w-4xl mx-auto">
              <Accordion type="single" collapsible className="w-full bg-card p-4 sm:p-6 rounded-lg shadow-md border">
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
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ToolsPage;
