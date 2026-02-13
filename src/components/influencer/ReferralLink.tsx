import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Link, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface ReferralLinkProps {
  userId: string;
}

const ReferralLink: React.FC<ReferralLinkProps> = ({ userId }) => {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const [copied, setCopied] = useState(false);
  const referralUrl = `${window.location.origin}/apply?ref=${userId}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast({ title: t('influencer.referralLink.copied') });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link className="h-5 w-5 text-primary" />
          {t('influencer.referralLink.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{t('influencer.referralLink.description')}</p>
        <div className="flex gap-2">
          <Input value={referralUrl} readOnly className="font-mono text-sm" dir="ltr" />
          <Button onClick={copyLink} variant="outline" className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReferralLink;
