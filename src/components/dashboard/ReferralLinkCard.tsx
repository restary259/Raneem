import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Share2, Link2 } from 'lucide-react';
import { buildReferralUrl } from '@/lib/referral';

interface ReferralLinkCardProps {
  userId: string;
  /** Optional short line explaining what the link earns the holder. */
  hint?: string;
}

/**
 * Shows the signed-in user's personal referral link. Used by partners,
 * ambassadors and students — one attribution mechanism, three audiences.
 */
const ReferralLinkCard: React.FC<ReferralLinkCardProps> = ({ userId, hint }) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (supabase as any)
      .from('profiles')
      .select('referral_code, referral_code_enabled')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!active) return;
        setCode(data?.referral_code ?? null);
        setEnabled(data?.referral_code_enabled !== false);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading || !code || !enabled) return null;

  const url = buildReferralUrl(code);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ description: t('referralLink.copied', 'Link copied') });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: 'destructive', description: t('referralLink.copyFailed', 'Could not copy the link') });
    }
  };

  const handleWhatsApp = () => {
    // Short message + link on its own line so WhatsApp renders a single clean preview.
    const text = `${t('referralLink.shareText', 'Apply to study in Germany with Darb')}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };


  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          {t('referralLink.title', 'My referral link')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {hint ?? t('referralLink.hint', 'Every student who applies through this link is credited to you automatically.')}
        </p>

        <div className="flex items-center gap-2">
          <Input readOnly value={url} dir="ltr" className="text-xs font-mono" aria-label={t('referralLink.title', 'My referral link')} />
          <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label={t('referralLink.copy', 'Copy link')}>
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {t('referralLink.code', 'Code')}: <span className="font-mono font-semibold text-foreground">{code}</span>
          </span>
          <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={handleWhatsApp}>
            <Share2 className="h-4 w-4" />
            {t('referralLink.whatsapp', 'Share on WhatsApp')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReferralLinkCard;
