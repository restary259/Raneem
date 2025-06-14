
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "هل هناك حد أدنى للأرباح أو المتابعين للانضمام؟",
    answer: "لا يوجد أي حد أدنى. نرحب بالجميع، سواء كنت مؤثراً كبيراً أو لديك شبكة علاقات صغيرة ولكنها قوية. الأهم هو جودة الجمهور واهتمامه بالدراسة في الخارج."
  },
  {
    question: "متى وكيف يتم دفع الأرباح؟",
    answer: "يتم دفع الأرباح خلال 7 أيام عمل من تاريخ إتمام الطالب لعملية الدفع لخدماتنا. يتم الدفع عبر التحويل البنكي أو PayPal حسب تفضيلك."
  },
  {
    question: "هل يمكنني الترويج للخدمات حتى لو لم أكن طالباً سابقاً لديكم؟",
    answer: "بالتأكيد! لا يُشترط أن تكون أحد عملائنا السابقين. يمكنك الانضمام ومشاركة رابطك طالما أنك تؤمن بجودة خدماتنا وقيمتها للطلاب."
  },
    {
    question: "كيف يمكنني تتبع النقرات والتحويلات؟",
    answer: "بمجرد قبولك في البرنامج، ستحصل على وصول إلى لوحة تحكم خاصة بالشركاء تتيح لك رؤية تقارير مفصلة عن أداء روابطك، عدد النقرات، التسجيلات المكتملة، والأرباح المستحقة."
  }
];

const Faq = () => {
  return (
    <section className="py-12 md:py-24">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">أسئلة شائعة</h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
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
