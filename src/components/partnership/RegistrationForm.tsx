
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ConsentBlock from "@/components/common/ConsentBlock";
import { POLICY_VERSION, recordConsent } from "@/lib/consent";

import { useDirection } from '@/hooks/useDirection';

const RegistrationForm = () => {
  const { t, i18n } = useTranslation('partnership');
  const { dir } = useDirection();
  const isAr = i18n.language?.startsWith('ar');
  const formContent = t('registrationForm', { returnObjects: true }) as any;
  const contactOptions = formContent.contactOptions as Record<string, string>;

  const formSchema = z.object({
    name: z.string().min(2, { message: t('registrationForm.validation.nameMin') }),
    countryCity: z.string().min(2, { message: t('registrationForm.validation.countryCityMin') }),
    email: z.string().email({ message: t('registrationForm.validation.emailInvalid') }),
    phone: z.string().min(9, { message: t('registrationForm.validation.phoneMin') }),
    preferredContact: z.string({ required_error: t('registrationForm.validation.contactRequired') }),
    aboutYou: z.string().optional(),
    instagramLink: z.string().optional(),
    socialLinks: z.string().optional(),
    previousExperience: z.enum(["yes", "no"], { required_error: t('registrationForm.validation.experienceRequired') }),
    whyDarb: z.string().min(10, { message: t('registrationForm.validation.whyDarbMin') }),
    consent: z.literal(true, {
      errorMap: () => ({ message: t('registrationForm.validation.consentRequired') }),
    }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      countryCity: "",
      phone: "",
      aboutYou: "",
      instagramLink: "",
      socialLinks: "",
      whyDarb: "",
      consent: false as unknown as true,
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // A master partner's recruiting link carries ?ref=CODE — resolve it so the
      // application records who recruited this applicant.
      const refCode = new URLSearchParams(window.location.search).get('ref');
      let recruiter: { partner_id: string; partner_name: string } | null = null;
      if (refCode) {
        const { data } = await (supabase as any).rpc('resolve_partner_link', { p_code: refCode });
        const row = Array.isArray(data) ? data[0] : null;
        if (row?.purpose === 'recruit') {
          recruiter = { partner_id: row.partner_id, partner_name: row.partner_name };
        }
      }

      // Consent is recorded alongside the application itself: status, timestamp
      // and the policy version the applicant actually saw.
      const payload = {
        ...values,
        consent: true,
        consent_at: new Date().toISOString(),
        policy_version: POLICY_VERSION,
      };

      // Store first: an application must survive an email delivery failure.
      const { error: insertError } = await (supabase as any)
        .from('contact_submissions')
        .insert({
          form_source: 'partnership',
          data: recruiter
            ? { ...payload, recruited_by_code: refCode, recruited_by_id: recruiter.partner_id, recruited_by_name: recruiter.partner_name }
            : payload,
          status: 'new',
        });
      if (insertError) throw new Error(insertError.message);

      // Append-only consent record (never blocks the submission itself).
      await recordConsent({
        sourceForm: 'partnership_form',
        subjectName: values.name,
        email: values.email,
        phone: values.phone,
        serviceContact: true,
        marketing: false,
        locale: i18n.language,
      });

      // Note: no email notification is sent — admins read applications in the admin Inbox.
      return { success: true };
    },
    onSuccess: () => {
        toast.success(t('registrationForm.toasts.success'));
        form.reset();
    },
    onError: (error) => {
        toast.error(t('registrationForm.toasts.error', { error: error.message }));
    },
  });


  function onSubmit(values: z.infer<typeof formSchema>) {
    mutate(values);
  }

  return (
    <section id="register" className="py-12 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <Card className="max-w-3xl mx-auto shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">{formContent.title}</CardTitle>
            <CardDescription>{formContent.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>{formContent.fullName}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="countryCity" render={({ field }) => (
                    <FormItem><FormLabel>{formContent.countryCity}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>{formContent.email}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>{formContent.phone}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                 <FormField control={form.control} name="preferredContact" render={({ field }) => (
                    <FormItem><FormLabel>{formContent.preferredContact}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} dir={dir}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            {Object.entries(contactOptions).map(([key, value]) => (
                                <SelectItem key={key} value={key}>{value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />

                {/* Social media links instead of file upload */}
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="instagramLink" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{formContent.instagramLink || 'Instagram'}</FormLabel>
                      <FormControl><Input placeholder="@username" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="socialLinks" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{formContent.socialLinks || 'Social Media Links'}</FormLabel>
                      <FormControl><Input placeholder="TikTok, YouTube, etc." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="aboutYou" render={({ field }) => (
                  <FormItem><FormLabel>{formContent.aboutYou}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="previousExperience" render={({ field }) => (
                  <FormItem className="space-y-3"><FormLabel>{formContent.previousExperience}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-row flex-wrap gap-6"
                        aria-label={formContent.previousExperience}
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="yes" id="exp-yes" className="h-4 w-4 shrink-0" />
                          <label htmlFor="exp-yes" className="text-sm font-medium cursor-pointer">
                            {formContent.experienceOptions.yes}
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="no" id="exp-no" className="h-4 w-4 shrink-0" />
                          <label htmlFor="exp-no" className="text-sm font-medium cursor-pointer">
                            {formContent.experienceOptions.no}
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="whyDarb" render={({ field }) => (
                  <FormItem><FormLabel>{formContent.whyDarb}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" size="lg" variant="accent" className="w-full" disabled={isPending}>
                  {isPending ? t('registrationForm.submitting') : formContent.submit}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default RegistrationForm;
