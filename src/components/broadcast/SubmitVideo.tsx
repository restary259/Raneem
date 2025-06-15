
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SubmitVideo: React.FC = () => {
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
                            <form className="space-y-4 text-right" onSubmit={(e) => e.preventDefault()}>
                                <div className="space-y-2">
                                    <Label htmlFor="name">الاسم</Label>
                                    <Input id="name" placeholder="اسمك الكامل" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="university">الجامعة</Label>
                                    <Input id="university" placeholder="جامعتك الحالية" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="videoLink">رابط الفيديو (يوتيوب, ...)</Label>
                                    <Input id="videoLink" placeholder="https://youtube.com/..." />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="videoFile">أو ارفع ملف الفيديو</Label>
                                    <Input id="videoFile" type="file" accept="video/*" className="file:ml-4 file:font-sans" />
                                    <p className="text-xs text-muted-foreground">الحد الأقصى: 50 ميجابايت</p>
                                </div>
                                <Button type="submit" className="w-full">إرسال الفيديو</Button>
                            </form>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}

export default SubmitVideo;
