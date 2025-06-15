
import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const NewFaq = () => {
  const { t } = useTranslation('partnership');
  const faqItems = t('partnershipFaq.items', { returnObjects: true }) as { question: string, answer: string }[];

  return (
    <section className="py-12 md:py-24 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">{t('partnershipFaq.title')}</h2>
        <Accordion type="single" collapsible className="w-full">
          {Array.isArray(faqItems) && faqItems.map((item, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-right text-lg">{item.question}</AccordionTrigger>
              <AccordionContent className="text-right text-base text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default NewFaq;
