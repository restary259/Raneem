import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import Map from "./Map";
import OfficeLocations from "./OfficeLocations";
import { Instagram, Linkedin, Youtube } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, { message: "يجب أن يتكون الاسم من حرفين على الأقل." }),
  email: z.string().email({ message: "الرجاء إدخال بريد إلكتروني صالح." }),
  whatsapp: z.string().min(9, { message: "الرجاء إدخال رقم واتساب صالح." }),
  studyDestination: z.string({ required_error: "الرجاء اختيار بلد الدراسة." }),
  service: z.string({ required_error: "الرجاء اختيار الخدمة المطلوبة." }),
  message: z.string().optional(),
});

const serviceOptions = [
  "التقديم الجامعي",
  "الترجمة والتوثيق",
  "دورات اللغة",
  "التأشيرات والإقامة",
  "خدمات السكن",
  "الاستقبال والمتابعة",
  "الاستشارات الشخصية",
  "استشارة عامة"
];

const Contact = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", whatsapp: "", message: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    toast({
      title: "تم إرسال رسالتك بنجاح!",
      description: "شكرًا لتواصلك معنا. سيقوم أحد مستشارينا بالرد عليك قريبًا.",
    });
    form.reset();
  }

  return (
    <section id="contact" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 items-start">
          
          {/* Form Section */}
          <div className="lg:col-span-2 text-right p-8 bg-background/50 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl animate-scale-in">
            <div className="text-center md:text-right max-w-2xl mb-8">
              <h2 className="text-3xl md:text-4xl font-bold font-cairo">املأ النموذج للتواصل</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                فريقنا جاهز للإجابة على جميع استفساراتك ومساعدتك في تحقيق أهدافك الأكاديمية.
              </p>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>الاسم الكامل</FormLabel><FormControl><Input placeholder="اسمك الكامل" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>البريد الإلكتروني</FormLabel><FormControl><Input placeholder="your.email@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="whatsapp" render={({ field }) => (
                    <FormItem><FormLabel>رقم الواتساب</FormLabel><FormControl><Input placeholder="مع رمز الدولة" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                 <div className="grid md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="studyDestination" render={({ field }) => (
                        <FormItem><FormLabel>بلد الاهتمام بالدراسة</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                            <FormControl><SelectTrigger><SelectValue placeholder="اختر بلدًا" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="germany">ألمانيا</SelectItem><SelectItem value="romania">رومانيا</SelectItem><SelectItem value="jordan">الأردن</SelectItem></SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="service" render={({ field }) => (
                        <FormItem><FormLabel>الخدمة المطلوبة</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                            <FormControl><SelectTrigger><SelectValue placeholder="اختر خدمة" /></SelectTrigger></FormControl>
                            <SelectContent>{serviceOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="message" render={({ field }) => (
                  <FormItem><FormLabel>رسالة إضافية (اختياري)</FormLabel><FormControl><Textarea placeholder="اكتب رسالتك هنا..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full font-bold font-cairo" size="lg" variant="default">أرسل الآن</Button>
              </form>
            </Form>
          </div>

          {/* Side Info Section */}
          <div className="space-y-8">
            <OfficeLocations />
            <div className="bg-background/80 backdrop-blur-sm border border-white/20 p-6 rounded-2xl shadow-lg animate-fade-in">
              <h3 className="text-xl font-semibold mb-4 text-center font-cairo">تابعنا</h3>
              <div className="flex justify-center items-center space-x-6">
                <a href="#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><Instagram className="h-7 w-7" /></a>
                <a href="#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><Linkedin className="h-7 w-7" /></a>
                <a href="#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><Youtube className="h-7 w-7" /></a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 md:mt-24 text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-cairo">موقعنا على الخريطة</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                استكشف مواقع مكاتبنا حول العالم.
            </p>
            <div className="mt-8 h-[400px] md:h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-scale-in">
                <Map />
            </div>
        </div>

      </div>
    </section>
  )
}

export default Contact;
