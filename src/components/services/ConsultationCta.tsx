"use client"

import React from 'react';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"

const ConsultationCta = () => {
    const { t, i18n } = useTranslation('services');
    const { dir } = useDirection();
    const { toast } = useToast();
    const isAr = i18n.language === 'ar';

    const educationOptions = isAr
      ? ['بجروت / ثانوية', 'بكالوريوس', 'ماجستير']
      : ['Bagrut / High School', 'Bachelor', 'Master'];

    const majorOptions = isAr
      ? ['طب', 'هندسة', 'إدارة أعمال', 'علوم الحاسب', 'صيدلة', 'أخرى']
      : ['Medicine', 'Engineering', 'Business', 'Computer Science', 'Pharmacy', 'Other'];

    const formSchema = z.object({
      name: z.string().min(2, { message: t('consultationCta.validation.nameMin') }),
      phone: z.string().min(9, { message: isAr ? 'رقم الهاتف مطلوب' : 'Phone number is required' }),
      city: z.string().min(2, { message: isAr ? 'المدينة مطلوبة' : 'City is required' }),
      interestedMajor: z.string({ required_error: isAr ? 'اختر التخصص' : 'Select a major' }),
      educationLevel: z.string({ required_error: isAr ? 'المستوى التعليمي مطلوب' : 'Education level required' }),
      stillInSchool: z.enum(["yes", "no"], { required_error: isAr ? 'مطلوب' : 'Required' }),
      englishUnits: z.string().optional(),
      mathUnits: z.string().optional(),
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: "", phone: "", city: "", englishUnits: "", mathUnits: "" },
    });

    const { mutate, isPending } = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
          // Create lead via RPC
          const { error } = await supabase.rpc('insert_lead_from_apply', {
            p_full_name: values.name,
            p_phone: values.phone,
            p_city: values.city,
            p_education_level: values.educationLevel === 'بجروت / ثانوية' || values.educationLevel === 'Bagrut / High School' ? 'bagrut' : values.educationLevel.toLowerCase(),
            p_english_units: values.englishUnits ? parseInt(values.englishUnits) : null,
            p_math_units: values.mathUnits ? parseInt(values.mathUnits) : null,
            p_source_type: 'services_form',
          } as any);
          if (error) throw error;
          return { success: true };
        },
        onSuccess: () => {
          toast({ title: t('consultationCta.successTitle'), description: t('consultationCta.successDesc') });
          form.reset();
        },
        onError: (error) => {
          toast({ variant: "destructive", title: t('consultationCta.errorTitle'), description: error.message });
        },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        mutate(values);
    }

    return (
        <section className="py-12 md:py-24">
            <div className="container mx-auto px-4">
                <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
                    <div className="animate-fade-in">
                        <h2 className="text-3xl md:text-4xl font-bold text-primary">{t('consultationCta.title')}</h2>
                        <p className="mt-4 text-lg text-muted-foreground">{t('consultationCta.subtitle')}</p>
                    </div>
                    <div className="animate-fade-in animation-delay-300">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 bg-card p-6 md:p-8 rounded-lg shadow-lg border">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>{isAr ? 'الاسم الكامل' : 'Full Name'}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="phone" render={({ field }) => (
                                    <FormItem><FormLabel>{isAr ? 'رقم الهاتف' : 'Phone Number'}</FormLabel><FormControl><Input type="tel" dir="ltr" placeholder="05X-XXXXXXX" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-4">
                                  <FormField control={form.control} name="city" render={({ field }) => (
                                      <FormItem><FormLabel>{isAr ? 'المدينة' : 'City'}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                  )} />
                                  <FormField control={form.control} name="interestedMajor" render={({ field }) => (
                                      <FormItem><FormLabel>{isAr ? 'التخصص المهتم به' : 'Interested Major'}</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value} dir={dir}>
                                          <FormControl><SelectTrigger><SelectValue placeholder={isAr ? 'اختر' : 'Select'} /></SelectTrigger></FormControl>
                                          <SelectContent>{majorOptions.map(option => (
                                              <SelectItem key={option} value={option}>{option}</SelectItem>
                                          ))}</SelectContent>
                                      </Select><FormMessage /></FormItem>
                                  )} />
                                </div>
                                <FormField control={form.control} name="educationLevel" render={({ field }) => (
                                    <FormItem><FormLabel>{isAr ? 'المستوى التعليمي' : 'Education Level'}</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} dir={dir}>
                                        <FormControl><SelectTrigger><SelectValue placeholder={isAr ? 'اختر' : 'Select'} /></SelectTrigger></FormControl>
                                        <SelectContent>{educationOptions.map(option => (
                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}</SelectContent>
                                    </Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="stillInSchool" render={({ field }) => (
                                    <FormItem className="space-y-2"><FormLabel>{isAr ? 'ما زلت في المدرسة؟' : 'Still in School?'}</FormLabel>
                                      <FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                          <FormItem className="flex items-center space-x-2 space-x-reverse">
                                            <FormControl><RadioGroupItem value="yes" /></FormControl>
                                            <FormLabel>{isAr ? 'نعم' : 'Yes'}</FormLabel>
                                          </FormItem>
                                          <FormItem className="flex items-center space-x-2 space-x-reverse">
                                            <FormControl><RadioGroupItem value="no" /></FormControl>
                                            <FormLabel>{isAr ? 'لا' : 'No'}</FormLabel>
                                          </FormItem>
                                        </RadioGroup>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-4">
                                  <FormField control={form.control} name="englishUnits" render={({ field }) => (
                                      <FormItem><FormLabel>{isAr ? 'وحدات الإنجليزي' : 'English Units'}</FormLabel><FormControl><Input type="number" min="1" max="5" dir="ltr" placeholder="3-5" {...field} /></FormControl><FormMessage /></FormItem>
                                  )} />
                                  <FormField control={form.control} name="mathUnits" render={({ field }) => (
                                      <FormItem><FormLabel>{isAr ? 'وحدات الرياضيات' : 'Math Units'}</FormLabel><FormControl><Input type="number" min="1" max="5" dir="ltr" placeholder="3-5" {...field} /></FormControl><FormMessage /></FormItem>
                                  )} />
                                </div>
                                <Button type="submit" variant="accent" size="lg" className="w-full font-bold" disabled={isPending}>
                                    {isPending ? (isAr ? 'جار الإرسال...' : 'Sending...') : (isAr ? 'أرسل بياناتي' : 'Submit My Details')}
                                </Button>
                            </form>
                        </Form>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default ConsultationCta;
