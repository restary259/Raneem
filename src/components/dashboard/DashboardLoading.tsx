
import React from 'react';
import { useTranslation } from 'react-i18next';
import darbLogoAsset from '@/assets/darb-logo.png.asset.json';

const DashboardLoading: React.FC<{ label?: string }> = ({ label }) => {
  const { t } = useTranslation('dashboard');
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label ?? t('common.loading', 'جاري التحميل…')}</span>
      <img src={darbLogoAsset.url} alt="" width={182} height={64} className="h-auto w-44 animate-pulse object-contain motion-reduce:animate-none sm:w-52" />
    </div>
  );
};

export default DashboardLoading;
