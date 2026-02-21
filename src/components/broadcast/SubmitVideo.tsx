
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';

const SubmitVideo: React.FC = () => {
    const { toast } = useToast();
    const { t } = useTranslation('broadcast');
    const [name, setName] = useState('');
    const [university, setUniversity] = useState('');
    const [videoLink, setVideoLink] = useState('');

    const { mutate, isPending } = useMutation({
        mutationFn: async (values: { name: string, university: string, videoLink: string }) => {
            const result = await supabase.functions.invoke('send-email', {
                body: { form_source: 'Broadcast Video Submission Form', ...values },
            });
            if (result.error) throw new Error(`Function error: ${result.error.message}`);
            if (result.data?.error) throw new Error(result.data.error);
            if (!result.data?.success) throw new Error('Email sending failed');
            return result.data;
        },
        onSuccess: () => {
            toast({ title: t('submitSuccess'), description: t('submitSuccessDesc') });
            setName(''); setUniversity(''); setVideoLink('');
        },
        onError: (error) => {
            toast({ variant: "destructive", title: t('submitError'), description: t('submitErrorDesc', { error: error.message }) });
        },
    });

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!name || !university || !videoLink) {
            toast({ variant: 'destructive', title: t('missingFields'), description: t('missingFieldsDesc') });
            return;
        }
        mutate({ name, university, videoLink });
    };

    return (
        <section className="py-12 md:py-24 bg-muted/50">
            <div className="container">
                <Card className="max-w-2xl mx-auto">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">{t('submitTitle')}</CardTitle>
                        <CardDescription>{t('submitDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-4">
                            <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white w-full" asChild>
                                <a href="https://wa.me/972524061225" target="_blank" rel="noopener noreferrer">
                                    {t('sendWhatsapp')}
                                </a>
                            </Button>
                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">{t('or')}</span>
                                </div>
                            </div>
                            <form className="space-y-4 text-right" onSubmit={handleSubmit}>
                                <div className="space-y-2">
                                    <Label htmlFor="name-sv">{t('nameLabel')}</Label>
                                    <Input id="name-sv" placeholder={t('namePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="university-sv">{t('universityLabel')}</Label>
                                    <Input id="university-sv" placeholder={t('universityPlaceholder')} value={university} onChange={e => setUniversity(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="videoLink-sv">{t('videoLinkLabel')}</Label>
                                    <Input id="videoLink-sv" placeholder={t('videoLinkPlaceholder')} value={videoLink} onChange={e => setVideoLink(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="videoFile-sv">{t('uploadLabel')}</Label>
                                    <Input id="videoFile-sv" type="file" accept="video/*" className="file:ml-4 file:font-sans" disabled />
                                    <p className="text-xs text-muted-foreground">{t('uploadLimit')}</p>
                                </div>
                                <Button type="submit" className="w-full" disabled={isPending}>
                                    {isPending ? t('submitting') : t('submitButton')}
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
