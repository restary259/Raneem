import React from 'react';
import { WifiOff } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';
import { useTranslation } from 'react-i18next';

const OfflineIndicator = () => {
  const { isOnline } = usePWA();
  const { t } = useTranslation();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-destructive text-destructive-foreground px-4 py-2 text-center z-50">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span className="text-sm font-medium">
          {t('offline.message')}
        </span>
      </div>
    </div>
  );
};

export default OfflineIndicator;
