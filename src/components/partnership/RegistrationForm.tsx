
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const formSchema = z.object({
  name: z.string().min(2, { message: "الاسم يجب أن يحتوي على حرفين على الأقل." }),
  countryCity: z.string().min(2, { message: "الرجاء إدخال الدولة والمدينة." }),
  email: z.string().email({ message: "البريد الإلكتروني غير صالح." }),
  phone: z.string().min(9, { message: "الرجاء إدخال رقم هاتف صالح." }),
  preferredContact: z.string({ required_error: "الرجاء اختيار وسيلة التواصل." }),
  aboutYou: z.string().optional(),
  previousExperience: z.enum(["yes", "no"], { required_error: "الرجاء تحديد خبرتك السابقة." }),
  whyDarb: z.string().min(10, { message: "الرجاء كتابة 10 أحرف على الأقل." }),
  attachment: z.instanceof(FileList).optional(),
});

const RegistrationForm = () => {
  const { t } = useTranslation('partnership');
  const formContent = t('registrationForm', { returnObjects: true }) as any;
  const contactOptions = formContent.contactOptions as Record<string, string>;
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      countryCity: "",
      phone: "",
      aboutYou: "",
      whyDarb: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: Omit<z.infer<typeof formSchema>, 'attachment'>) => {
        return supabase.functions.invoke('send-email', {
            body: {
                form_source: 'Partnership Registration Form',
                ...values,
            },
        });
    },
    onSuccess: (result) => {
        if (result.error) throw new Error(result.error.message);
        toast.success(formContent.success);
        form.reset();
    },
    onError: (error) => {
        toast.error("فشل إرسال النموذج. الرجاء المحاولة مرة أخرى.");
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const { attachment, ...otherValues } = values;
    mutate(otherValues);
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
                    <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            {Object.entries(contactOptions).map(([key, value]) => (
                                <SelectItem key={key} value={key}>{value}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="aboutYou" render={({ field }) => (
                  <FormItem><FormLabel>{formContent.aboutYou}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="previousExperience" render={({ field }) => (
                  <FormItem className="space-y-3"><FormLabel>{formContent.previousExperience}</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                        <FormItem className="flex items-center space-x-2 space-x-reverse">
                          <FormControl><RadioGroupItem value="yes" id="exp-yes" /></FormControl>
                          <FormLabel htmlFor="exp-yes">{formContent.experienceOptions.yes}</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-x-reverse">
                          <FormControl><RadioGroupItem value="no" id="exp-no" /></FormControl>
                          <FormLabel htmlFor="exp-no">{formContent.experienceOptions.no}</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="whyDarb" render={({ field }) => (
                  <FormItem><FormLabel>{formContent.whyDarb}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField
                  control={form.control}
                  name="attachment"
                  render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem>
                      <FormLabel>{formContent.attachment}</FormLabel>
                      <FormControl>
                        <Input type="file" onChange={e => onChange(e.target.files)} {...rest} disabled />
                      </FormControl>
                      <FormDescription>خاصية رفع الملفات غير متاحة حالياً.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="lg" variant="accent" className="w-full" disabled={isPending}>
                  {isPending ? "جار الإرسال..." : formContent.submit}
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
