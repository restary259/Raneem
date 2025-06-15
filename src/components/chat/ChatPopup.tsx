
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Send, MessageCircle, Info, Briefcase } from 'lucide-react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from 'react-router-dom';

const formSchema = z.object({
  name: z.string().min(2, { message: "يجب أن يتكون الاسم من حرفين على الأقل." }),
  email: z.string().email({ message: "الرجاء إدخال بريد إلكتروني صالح." }),
  message: z.string().min(10, { message: "يجب أن تتكون الرسالة من 10 أحرف على الأقل." }),
});

const office = {
    whatsapp: '972524061225',
    hours: 'الأحد - الخميس: 9 صباحًا - 5 مساءً',
};

const ChatPopup = ({ onClose }: { onClose: () => void }) => {
    const { toast } = useToast();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: "", email: "", message: "" },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        console.log("Chat form submitted:", values);
        toast({
          title: "تم إرسال رسالتك بنجاح!",
          description: "شكرًا لتواصلك. سنرد عليك في أقرب وقت ممكن.",
        });
        form.reset();
        onClose();
    }

    return (
        <div 
            dir="rtl" 
            className="fixed bottom-24 right-6 z-[998] w-[350px] animate-in slide-in-from-bottom-10 fade-in duration-300 sm:w-[380px]"
        >
            <Card className="flex flex-col h-[600px] max-h-[80vh] shadow-2xl rounded-2xl overflow-hidden bg-background/80 backdrop-blur-sm border-white/20">
                <CardHeader className="flex flex-row items-center justify-between bg-primary text-primary-foreground p-4">
                    <div>
                        <CardTitle className="text-lg">مرحبا بك في درب!</CardTitle>
                        <CardDescription className="text-primary-foreground/80 text-sm">كيف يمكننا مساعدتك اليوم؟</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-primary/80 shrink-0">
                        <X className="h-5 w-5" />
                    </Button>
                </CardHeader>

                <CardContent className="p-4 space-y-4 flex-grow overflow-y-auto">
                    <p className="text-sm text-center text-muted-foreground p-2 bg-secondary rounded-lg">
                        ساعات العمل: {office.hours}.
                    </p>
                    
                    <div className="space-y-3">
                        <h4 className="font-semibold text-center text-primary">إجراءات سريعة</h4>
                        <div className="grid grid-cols-1 gap-2">
                             <Button asChild variant="outline" className="justify-end">
                                <a href={`https://wa.me/${office.whatsapp}?text=${encodeURIComponent("مرحباً درب، أود الاستفسار بخصوص خدماتكم.")}`} target="_blank" rel="noopener noreferrer">
                                    تحدث معنا عبر واتساب
                                    <MessageCircle className="mr-2 h-5 w-5" />
                                </a>
                             </Button>
                             <Button asChild variant="outline" className="justify-end">
                                <Link to="/services">
                                    اكتشف خدماتنا
                                    <Briefcase className="mr-2 h-5 w-5" />
                                </Link>
                             </Button>
                             <Button asChild variant="outline" className="justify-end">
                                <Link to="/about">
                                    تعرف علينا أكثر
                                    <Info className="mr-2 h-5 w-5" />
                                </Link>
                             </Button>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <h4 className="font-semibold text-center mb-2 text-primary">أو اترك رسالة</h4>
                         <Form {...form}>
                          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">الاسم</FormLabel><FormControl><Input placeholder="اسمك الكامل" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">البريد الإلكتروني</FormLabel><FormControl><Input placeholder="your.email@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="message" render={({ field }) => (
                              <FormItem><FormLabel className="text-xs">رسالتك</FormLabel><FormControl><Textarea placeholder="كيف يمكننا المساعدة؟" {...field} className="h-20" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <Button type="submit" className="w-full font-bold">
                                أرسل الرسالة
                                <Send className="mr-2 h-4 w-4" />
                            </Button>
                          </form>
                        </Form>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
};

export default ChatPopup;
