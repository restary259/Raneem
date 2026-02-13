
import { useState } from "react";
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
import { Instagram, Facebook, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDirection } from "@/hooks/useDirection";
import TikTokIcon from "../icons/TikTokIcon";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Contact = () => {
  const { t } = useTranslation(['contact', 'common']);
  const { dir } = useDirection();
  const serviceOptions = t('contact.form.serviceOptions', { returnObjects: true, ns: 'contact' }) as string[];

  const formSchema = z.object({
    name: z.string().min(2, { message: t('contact.validation.nameMin', { ns: 'common' }) }),
    email: z.string().email({ message: t('contact.validation.emailInvalid', { ns: 'common' }) }),
    whatsapp: z.string().min(9, { message: t('contact.validation.whatsappMin', { ns: 'common' }) }),
    studyDestination: z.string({ required_error: t('contact.validation.destinationRequired', { ns: 'common' }) }),
    service: z.string({ required_error: t('contact.validation.serviceRequired', { ns: 'common' }) }),
    message: z.string().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", whatsapp: "", message: "" },
  });

  const [honeypot, setHoneypot] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const result = await supabase.functions.invoke('send-email', {
        body: {
          form_source: 'Contact Page Form',
          honeypot,
          ...values,
        },
      });

      if (result.error) {
        throw new Error(`Function error: ${result.error.message}`);
      }

      if (result.data?.error) {
        throw new Error(result.data.error);
      }

      if (!result.data?.success) {
        throw new Error('Email sending failed');
      }

      return result.data;
    },
    onSuccess: () => {
      toast({ title: t('contact.successTitle', { ns: 'common' }), description: t('contact.successDesc', { ns: 'common' }) });
      form.reset();
    },
    onError: (error) => {
      toast({ variant: "destructive", title: t('contact.errorTitle', { ns: 'common' }), description: error.message });
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutate(values);
  }

  return (
    <section id="contact" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 items-start">
          
          <div className="lg:col-span-2 text-right p-4 sm:p-6 md:p-8 bg-background/80 border border-white/20 rounded-2xl shadow-2xl animate-scale-in">
            <div className="text-center md:text-right max-w-2xl mb-8">
              <h2 className="text-3xl md:text-4xl font-bold">{t('contact.title')}</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {t('contact.subtitle')}
              </p>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4 md:gap-6">
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
                 <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                    <FormField control={form.control} name="studyDestination" render={({ field }) => (
                        <FormItem><FormLabel>{t('contact.form.destination')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} dir={dir}>
                            <FormControl><SelectTrigger><SelectValue placeholder={t('contact.form.destinationPlaceholder')} /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="germany">{t('contact.form.destinationOptions.germany')}</SelectItem></SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="service" render={({ field }) => (
                        <FormItem><FormLabel>{t('contact.form.service')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} dir={dir}>
                            <FormControl><SelectTrigger><SelectValue placeholder={t('contact.form.servicePlaceholder')} /></SelectTrigger></FormControl>
                            <SelectContent>{serviceOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="message" render={({ field }) => (
                  <FormItem><FormLabel>{t('contact.form.message')}</FormLabel><FormControl><Textarea placeholder={t('contact.form.messagePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                {/* Honeypot anti-spam - invisible to humans */}
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />
                <Button type="submit" className="w-full font-bold" size="lg" variant="default" disabled={isPending}>
                  {isPending ? t('contact.submitting', { ns: 'common' }) : t('contact.form.submit')}
                </Button>
              </form>
            </Form>
          </div>

          <div className="space-y-8">
            <OfficeLocations />
            <div className="bg-background/90 border border-white/20 p-6 rounded-2xl shadow-lg animate-fade-in">
              <h3 className="text-xl font-semibold mb-4 text-center">{t('contact.follow')}</h3>
              <div className="flex justify-center items-center gap-6">
                <a href="https://www.instagram.com/darb_studyingermany/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><Instagram className="h-7 w-7" /></a>
                <a href="https://www.tiktok.com/@darb_studyingrmany" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><TikTokIcon className="h-7 w-7" /></a>
                <a href="https://www.facebook.com/people/درب-للدراسة-في-المانيا/61557861907067/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><Facebook className="h-7 w-7" /></a>
                <a href="https://api.whatsapp.com/message/IVC4VCAEJ6TBD1" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><MessageCircle className="h-7 w-7" /></a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 md:mt-24 text-center">
            <h2 className="text-3xl md:text-4xl font-bold">{t('contact.mapTitle')}</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                {t('contact.mapSubtitle')}
            </p>
            <div className="mt-8 h-[300px] sm:h-[400px] md:h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-scale-in">
                <Map />
            </div>
        </div>

      </div>
    </section>
  )
}

export default Contact;
