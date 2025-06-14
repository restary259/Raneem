
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import Map from "./Map";

const formSchema = z.object({
  name: z.string().min(2, { message: "يجب أن يتكون الاسم من حرفين على الأقل." }),
  email: z.string().email({ message: "الرجاء إدخال بريد إلكتروني صالح." }),
  whatsapp: z.string().min(10, { message: "الرجاء إدخال رقم واتساب صالح." }),
  country: z.string({ required_error: "الرجاء اختيار بلد." }),
});

const Contact = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", whatsapp: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    toast({
      title: "تم إرسال النموذج!",
      description: "لقد تلقينا طلبك وسنعاود الاتصال بك قريبًا.",
    });
    form.reset();
  }

  return (
    <section id="contact" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">التواصل والحجز</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            هل أنت مستعد لبدء رحلتك؟ احجز استشارة مجانية أو أرسل لنا أسئلتك.
          </p>
        </div>
        <div className="mt-12 grid md:grid-cols-2 gap-12 items-start">
          <div className="text-right">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>الاسم</FormLabel>
                    <FormControl><Input placeholder="اسمك" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>البريد الإلكتروني</FormLabel>
                    <FormControl><Input placeholder="your.email@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="whatsapp" render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم الواتساب</FormLabel>
                    <FormControl><Input placeholder="+1234567890" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="country" render={({ field }) => (
                  <FormItem>
                    <FormLabel>بلد الاهتمام</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                      <FormControl><SelectTrigger><SelectValue placeholder="اختر بلدًا" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="germany">ألمانيا</SelectItem>
                        <SelectItem value="romania">رومانيا</SelectItem>
                        <SelectItem value="jordan">الأردن</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" size="lg" variant="accent">احجز استشارة مجانية</Button>
              </form>
            </Form>
          </div>
          <div className="space-y-6 text-right">
            <div className="bg-background p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">طرق أخرى للتواصل</h3>
              <div className="space-y-4">
                <a href="https://wa.me/1234567890" target="_blank" rel="noopener noreferrer" className="flex items-center justify-end gap-3 hover:text-primary transition-colors">
                  <span>تحدث عبر الواتساب</span>
                  <Phone className="h-6 w-6" />
                </a>
                <div className="flex items-center justify-end gap-3 text-muted-foreground">
                  <span>دردشة مباشرة (قريباً)</span>
                  <MessageCircle className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="bg-background p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">مكاتبنا</h3>
              <Map />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Contact;
