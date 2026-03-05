import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Copy, CheckCircle2, Share2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DashboardLoading from '@/components/dashboard/DashboardLoading';
import { useDirection } from '@/hooks/useDirection';

export default function PartnerLinkPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const { dir } = useDirection();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate('/student-auth'); return; }
      setUserId(session.user.id);
    });
  }, [navigate]);

  if (!userId) return <DashboardLoading />;

  const baseUrl = window.location.origin;
  const refLink = `${baseUrl}/apply?ref=${userId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true);
      toast({ title: t('influencer.referralLink.copied', 'Link copied!') });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'DARB Study Abroad', url: refLink });
    } else {
      handleCopy();
    }
  };

  const tips = [
    t('partner.tips.bio', 'Add your referral link to your profile bio'),
    t('partner.tips.stories', 'Share student success stories in your Stories'),
    t('partner.tips.hashtags', 'Use hashtags like #StudyInGermany #دراسةفيألمانيا'),
    t('partner.tips.results', 'Share real student results (with permission)'),
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Link2 className="h-6 w-6 text-primary" />
          {t('partner.myLink', 'My Referral Link')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('influencer.referralLink.description', 'Share this link. Students who apply through it are linked to your account.')}
        </p>
      </div>

      {/* Link Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={refLink}
              readOnly
              className="font-mono text-sm bg-background"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button size="icon" variant="default" onClick={handleCopy} className="shrink-0">
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
              {t('partner.copyLink', 'Copy Link')}
            </Button>
            <Button variant="default" className="flex-1 gap-2" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
              {t('partner.shareLink', 'Share')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp quick share */}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${t('partner.waMessage', 'Apply to DARB Study Abroad using my link')} 👇\n${refLink}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full rounded-lg border border-border bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] py-3 font-medium text-sm transition-colors"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        {t('partner.shareWhatsApp', 'Share via WhatsApp')}
      </a>

      {/* Tips */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">💡 {t('partner.tipsTitle', 'Marketing Tips')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
