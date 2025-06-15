
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

const SubmitVideo: React.FC = () => {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [university, setUniversity] = useState('');
    const [videoLink, setVideoLink] = useState('');

    const { mutate, isPending } = useMutation({
        mutationFn: (values: { name: string, university: string, videoLink: string }) => {
            return supabase.functions.invoke('send-email', {
                body: {
                    form_source: 'Broadcast Video Submission Form',
                    ...values,
                },
            });
        },
        onSuccess: (result) => {
            if (result.error) throw new Error(result.error.message);
            toast({
                title: "تم إرسال الفيديو بنجاح!",
                description: "شكراً لمشاركتك. سنراجعه قريباً.",
            });
            setName('');
            setUniversity('');
            setVideoLink('');
        },
        onError: (error) => {
            toast({
                variant: "destructive",
                title: "حدث خطأ",
                description: "فشل إرسال الفيديو. الرجاء المحاولة مرة أخرى.",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!name || !university || !videoLink) {
            toast({
                variant: 'destructive',
                title: 'بيانات ناقصة',
                description: 'الرجاء ملء حقول الاسم والجامعة ورابط الفيديو.',
            });
            return;
        }
        mutate({ name, university, videoLink });
    };

    return (
        <section className="py-12 md:py-24 bg-muted/50 dark:bg-muted/20">
            <div className="container">
                <Card className="max-w-2xl mx-auto">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">هل لديك لحظة مميزة تريد مشاركتها؟</CardTitle>
                        <CardDescription>شاركنا قصة نجاحك أو تجربتك لتلهم الآخرين</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-4">
                            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white w-full" asChild>
                                <a href="https://wa.me/972524061225" target="_blank" rel="noopener noreferrer">
                                    أرسل لنا عبر واتساب
                                </a>
                            </Button>
                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">أو</span>
                                </div>
                            </div>
                            <form className="space-y-4 text-right" onSubmit={handleSubmit}>
                                <div className="space-y-2">
                                    <Label htmlFor="name-sv">الاسم</Label>
                                    <Input id="name-sv" placeholder="اسمك الكامل" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="university-sv">الجامعة</Label>
                                    <Input id="university-sv" placeholder="جامعتك الحالية" value={university} onChange={e => setUniversity(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="videoLink-sv">رابط الفيديو (يوتيوب, ...)</Label>
                                    <Input id="videoLink-sv" placeholder="https://youtube.com/..." value={videoLink} onChange={e => setVideoLink(e.target.value)} />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="videoFile-sv">أو ارفع ملف الفيديو</Label>
                                    <Input id="videoFile-sv" type="file" accept="video/*" className="file:ml-4 file:font-sans" disabled />
                                    <p className="text-xs text-muted-foreground">الحد الأقصى: 50 ميجابايت (غير متاح حاليًا)</p>
                                </div>
                                <Button type="submit" className="w-full" disabled={isPending}>
                                  {isPending ? "جار الإرسال..." : "إرسال الفيديو"}
                                </Button>
                            </form>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}

export default SubmitVideo;
