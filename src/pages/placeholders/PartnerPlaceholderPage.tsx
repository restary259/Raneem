import React from 'react';
import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';

export default function PartnerPlaceholderPage() {
  const { t } = useTranslation('dashboard');
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <Construction className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold text-foreground">{t('placeholder.partnerTitle', 'Partner Dashboard')}</h2>
      <p className="text-muted-foreground max-w-sm">{t('placeholder.comingSoon', 'This section is being built. Check back soon.')}</p>
    </div>
  );
}
