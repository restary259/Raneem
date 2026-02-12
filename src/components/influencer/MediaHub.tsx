import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Image, FileText, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const assetKeys = ['logo', 'instagram', 'brochure', 'video'] as const;
const assetIcons = { logo: Image, instagram: Image, brochure: FileText, video: Video };

const MediaHub: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const tips = t('influencer.mediaHub.tips', { returnObjects: true }) as string[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('influencer.mediaHub.promoContent')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {assetKeys.map((key) => {
              const Icon = assetIcons[key];
              return (
                <div key={key} className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{t(`influencer.mediaHub.assets.${key}.title`)}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{t(`influencer.mediaHub.assets.${key}.desc`)}</p>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground mt-1" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('influencer.mediaHub.marketingTips')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {Array.isArray(tips) && tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaHub;
