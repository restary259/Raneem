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
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  name: z.string().min(2, { message: "يجب أن يتكون الاسم من حرفين على الأقل." }),
  email: z.string().email({ message: "الرجاء إدخال بريد إلكتروني صالح." }),
  whatsapp: z.string().min(9, { message: "الرجاء إدخال رقم واتساب صالح." }),
  studyDestination: z.string({ required_error: "الرجاء اختيار بلد الدراسة." }),
  service: z.string({ required_error: "الرجاء اختيار الخدمة المطلوبة." }),
  message: z.string().optional(),
});

const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-2.43.03-4.83-.95-6.43-2.88-1.59-1.92-2.3-4.45-1.96-6.84.34-2.38 1.95-4.48 3.98-5.61.99-.54 2.11-.83 3.25-.83.01 2.11-.01 4.22.01 6.33-.02 1.21-.57 2.36-1.55 3.14-1.63 1.29-4.04 1.05-5.38-.61-.92-1.15-1.16-2.67-.81-4.06.35-1.39 1.32-2.58 2.5-3.33.91-.56 2-.85 3.11-.85.02 1.48.01 2.96.01 4.44z"></path>
    </svg>
);

const Contact = () => {
  const { t } = useTranslation();
  const serviceOptions = t('contact.form.serviceOptions', { returnObjects: true }) as string[];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", whatsapp: "", message: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    toast({
      title: t('contact.toast.successTitle'),
      description: t('contact.toast.successDescription'),
    });
    form.reset();
  }

  return (
    <section id="contact" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 items-start">
          
          <div className="lg:col-span-2 text-right p-8 bg-background/50 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl animate-scale-in">
            <div className="text-center md:text-right max-w-2xl mb-8">
              <h2 className="text-3xl md:text-4xl font-bold">{t('contact.title')}</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {t('contact.subtitle')}
              </p>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>{t('contact.form.name')}</FormLabel><FormControl><Input placeholder={t('contact.form.namePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>{t('contact.form.email')}</FormLabel><FormControl><Input placeholder={t('contact.form.emailPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="whatsapp" render={({ field }) => (
                    <FormItem><FormLabel>{t('contact.form.whatsapp')}</FormLabel><FormControl><Input placeholder={t('contact.form.whatsappPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                 <div className="grid md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="studyDestination" render={({ field }) => (
                        <FormItem><FormLabel>{t('contact.form.destination')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                            <FormControl><SelectTrigger><SelectValue placeholder={t('contact.form.destinationPlaceholder')} /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="germany">{t('contact.form.destinationOptions.germany')}</SelectItem><SelectItem value="romania">{t('contact.form.destinationOptions.romania')}</SelectItem><SelectItem value="jordan">{t('contact.form.destinationOptions.jordan')}</SelectItem></SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="service" render={({ field }) => (
                        <FormItem><FormLabel>{t('contact.form.service')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                            <FormControl><SelectTrigger><SelectValue placeholder={t('contact.form.servicePlaceholder')} /></SelectTrigger></FormControl>
                            <SelectContent>{serviceOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="message" render={({ field }) => (
                  <FormItem><FormLabel>{t('contact.form.message')}</FormLabel><FormControl><Textarea placeholder={t('contact.form.messagePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full font-bold" size="lg" variant="default">{t('contact.form.submit')}</Button>
              </form>
            </Form>
          </div>

          <div className="space-y-8">
            <OfficeLocations />
            <div className="bg-background/80 backdrop-blur-sm border border-white/20 p-6 rounded-2xl shadow-lg animate-fade-in">
              <h3 className="text-xl font-semibold mb-4 text-center">{t('contact.follow')}</h3>
              <div className="flex justify-center items-center space-x-6">
                <a href="https://instagram.com/darb_studyinternational" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><Instagram className="h-7 w-7" /></a>
                <a href="https://tiktok.com/@darb_studyinternational" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><TikTokIcon className="h-7 w-7" /></a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 md:mt-24 text-center">
            <h2 className="text-3xl md:text-4xl font-bold">{t('contact.mapTitle')}</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                {t('contact.mapSubtitle')}
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
