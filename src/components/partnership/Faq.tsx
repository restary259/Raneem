
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from "react-i18next";

const Faq = () => {
  const { t } = useTranslation('partnership');
  const faqs = t('partnershipFaq.items', { returnObjects: true }) as { question: string; answer: string; }[];
  
  return (
    <section className="py-12 md:py-24">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{t('partnershipFaq.title')}</h2>
        <Accordion type="single" collapsible className="w-full">
          {Array.isArray(faqs) && faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-lg text-right">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default Faq;
