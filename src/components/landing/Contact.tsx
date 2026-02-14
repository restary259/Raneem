
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

  const formSchema = z.object({
    name: z.string().trim().min(2, { message: t('contact.validation.nameMin', { ns: 'common' }) }),
    phone: z.string().trim().min(9, { message: t('contact.validation.whatsappMin', { ns: 'common' }) }),
    interestedMajor: z.string({ required_error: t('contact.validation.destinationRequired', { ns: 'common' }) }),
    city: z.string().trim().min(2, { message: "City is required" }),
    educationLevel: z.string({ required_error: "Education level is required" }),
    stillInSchool: z.string({ required_error: "Please select if you're still in school" }),
    englishUnits: z.coerce.number().int().min(0).max(5),
    mathUnits: z.coerce.number().int().min(0).max(5),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", phone: "", interestedMajor: "", city: "", educationLevel: "", stillInSchool: "", englishUnits: 0, mathUnits: 0 },
  });

  const [honeypot, setHoneypot] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // Honeypot check — silently succeed if filled
      if (honeypot) return { success: true };

      const { error } = await supabase.rpc('insert_lead_from_apply', {
        p_full_name: values.name,
        p_phone: values.phone,
        p_city: values.city,
        p_education_level: values.educationLevel,
        p_german_level: 'beginner',
        p_preferred_city: values.city,
        p_accommodation: false,
        p_source_type: 'contact_form',
        p_english_units: values.englishUnits,
        p_math_units: values.mathUnits,
      });

      if (error) throw new Error(error.message);
      return { success: true };
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
          
          <div className={`lg:col-span-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} p-4 sm:p-6 md:p-8 bg-background/80 border border-white/20 rounded-2xl shadow-2xl animate-scale-in`}>
            <div className={`text-center ${dir === 'rtl' ? 'md:text-right' : 'md:text-left'} max-w-2xl mb-8`}>
              <h2 className="text-3xl md:text-4xl font-bold">{t('contact.title')}</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {t('contact.subtitle')}
              </p>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                   <FormField control={form.control} name="name" render={({ field }) => (
                     <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Your full name" {...field} /></FormControl><FormMessage /></FormItem>
                   )} />
                   <FormField control={form.control} name="phone" render={({ field }) => (
                     <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="With country code" {...field} /></FormControl><FormMessage /></FormItem>
                   )} />
                   <FormField control={form.control} name="interestedMajor" render={({ field }) => (
                     <FormItem><FormLabel>Interested Major</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value} dir={dir}>
                       <FormControl><SelectTrigger><SelectValue placeholder="Select a major" /></SelectTrigger></FormControl>
                       <SelectContent><SelectItem value="engineering">Engineering</SelectItem><SelectItem value="business">Business</SelectItem><SelectItem value="medicine">Medicine</SelectItem><SelectItem value="humanities">Humanities</SelectItem><SelectItem value="natural-sciences">Natural Sciences</SelectItem></SelectContent>
                     </Select><FormMessage /></FormItem>
                   )} />
                   <FormField control={form.control} name="city" render={({ field }) => (
                     <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="Your city" {...field} /></FormControl><FormMessage /></FormItem>
                   )} />
                   <FormField control={form.control} name="educationLevel" render={({ field }) => (
                     <FormItem><FormLabel>Current Education Level</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value} dir={dir}>
                       <FormControl><SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger></FormControl>
                       <SelectContent><SelectItem value="highschool">High School</SelectItem><SelectItem value="bagrut">Bagrut</SelectItem><SelectItem value="bachelor">Bachelor's Degree</SelectItem><SelectItem value="master">Master's Degree</SelectItem></SelectContent>
                     </Select><FormMessage /></FormItem>
                   )} />
                   <FormField control={form.control} name="stillInSchool" render={({ field }) => (
                     <FormItem><FormLabel>Still in School?</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value} dir={dir}>
                       <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                       <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                     </Select><FormMessage /></FormItem>
                   )} />
                 </div>
                 <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                   <FormField control={form.control} name="englishUnits" render={({ field }) => (
                     <FormItem><FormLabel>English Units</FormLabel><FormControl><Input type="number" placeholder="0-5" min="0" max="5" {...field} /></FormControl><FormMessage /></FormItem>
                   )} />
                   <FormField control={form.control} name="mathUnits" render={({ field }) => (
                     <FormItem><FormLabel>Math Units</FormLabel><FormControl><Input type="number" placeholder="0-5" min="0" max="5" {...field} /></FormControl><FormMessage /></FormItem>
                   )} />
                 </div>
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
