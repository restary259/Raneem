
"use client"

import React from 'react';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

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

const formSchema = z.object({
  name: z.string().min(2, { message: "يجب أن يتكون الاسم من حرفين على الأقل." }),
  email: z.string().email({ message: "يرجى إدخال بريد إلكتروني صالح." }),
  country: z.string().min(2, { message: "يرجى إدخال اسم البلد." }),
  serviceType: z.string({ required_error: "يرجى اختيار نوع الخدمة." }),
});

const ConsultationCta = () => {
    const { toast } = useToast()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
          name: "",
          email: "",
          country: "",
        },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        console.log(values);
        toast({
          title: "تم إرسال طلبك بنجاح!",
          description: "سنتواصل معك في أقرب وقت ممكن.",
        })
        form.reset();
    }

    return (
        <section className="py-12 md:py-24">
            <div className="container mx-auto px-4">
                <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
                    <div className="text-right animate-fade-in">
                        <h2 className="text-3xl md:text-4xl font-bold font-cairo text-primary">هل أنت جاهز لبدء رحلتك؟</h2>
                        <p className="mt-4 text-lg text-muted-foreground">
                            املأ النموذج أدناه لحجز استشارة مجانية مع أحد خبرائنا. دعنا نساعدك في تحقيق حلمك بالدراسة في الخارج.
                        </p>
                    </div>
                    <div className="animate-fade-in animation-delay-300">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 bg-card p-8 rounded-lg shadow-lg border">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>الاسم الكامل</FormLabel>
                                            <FormControl>
                                                <Input placeholder="مثال: أحمد محمد" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>البريد الإلكتروني</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="example@email.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="country"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>بلد الإقامة الحالي</FormLabel>
                                            <FormControl>
                                                <Input placeholder="مثال: الأردن" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="serviceType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>الخدمة المطلوبة</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="اختر خدمة..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {serviceOptions.map(option => (
                                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" variant="accent" size="lg" className="w-full font-cairo font-bold">ابدأ الآن</Button>
                            </form>
                        </Form>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default ConsultationCta;
