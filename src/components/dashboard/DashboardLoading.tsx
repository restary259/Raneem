
import React from 'react';
import { useTranslation } from 'react-i18next';

const DashboardLoading: React.FC = () => {
  const { t } = useTranslation('dashboard');
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">{t('common.loading', 'جاري التحميل…')}</p>
      </div>
    </div>
  );
};

export default DashboardLoading;
