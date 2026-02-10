
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
import { useToast } from "@/hooks/use-toast"

const ConsultationCta = () => {
    const { t } = useTranslation('services');
    const { dir } = useDirection();
    const { toast } = useToast()

    const serviceOptions = t('consultationCta.serviceOptions', { returnObjects: true }) as string[];

    const formSchema = z.object({
      name: z.string().min(2, { message: t('consultationCta.validation.nameMin') }),
      email: z.string().email({ message: t('consultationCta.validation.emailInvalid') }),
      country: z.string().min(2, { message: t('consultationCta.validation.countryMin') }),
      serviceType: z.string({ required_error: t('consultationCta.validation.serviceRequired') }),
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: "", email: "", country: "" },
    });

    const { mutate, isPending } = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
          const result = await supabase.functions.invoke('send-email', {
            body: { form_source: 'Consultation CTA Form', ...values },
          });
          if (result.error) throw new Error(`Function error: ${result.error.message}`);
          if (result.data?.error) throw new Error(result.data.error);
          if (!result.data?.success) throw new Error('Email sending failed');
          return result.data;
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
                        <h2 className="text-3xl md:text-4xl font-bold font-cairo text-primary">{t('consultationCta.title')}</h2>
                        <p className="mt-4 text-lg text-muted-foreground">{t('consultationCta.subtitle')}</p>
                    </div>
                    <div className="animate-fade-in animation-delay-300">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 bg-card p-8 rounded-lg shadow-lg border">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>{t('consultationCta.fullName')}</FormLabel><FormControl><Input placeholder={t('consultationCta.namePlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="email" render={({ field }) => (
                                    <FormItem><FormLabel>{t('consultationCta.email')}</FormLabel><FormControl><Input type="email" placeholder="example@email.com" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="country" render={({ field }) => (
                                    <FormItem><FormLabel>{t('consultationCta.country')}</FormLabel><FormControl><Input placeholder={t('consultationCta.countryPlaceholder')} {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="serviceType" render={({ field }) => (
                                    <FormItem><FormLabel>{t('consultationCta.serviceType')}</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} dir={dir}>
                                        <FormControl><SelectTrigger><SelectValue placeholder={t('consultationCta.servicePlaceholder')} /></SelectTrigger></FormControl>
                                        <SelectContent>{Array.isArray(serviceOptions) && serviceOptions.map(option => (
                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}</SelectContent>
                                    </Select><FormMessage /></FormItem>
                                )} />
                                <Button type="submit" variant="accent" size="lg" className="w-full font-cairo font-bold" disabled={isPending}>
                                    {isPending ? t('consultationCta.submitting') : t('consultationCta.submit')}
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
