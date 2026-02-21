import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DashboardContainerProps {
  isLoading: boolean;
  error: string | null;
  isEmpty?: boolean;
  onRetry: () => void;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Reusable wrapper that handles the Loading / Error / Empty / Content states
 * for all dashboard pages consistently.
 */
const DashboardContainer: React.FC<DashboardContainerProps> = ({
  isLoading,
  error,
  isEmpty = false,
  onRetry,
  emptyMessage = 'No data available.',
  emptyIcon,
  children,
}) => {
  const { t } = useTranslation('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">{t('common.loading', 'جاري التحميل…')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="font-semibold text-lg">{t('common.loadError', 'فشل تحميل البيانات')}</h2>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button onClick={onRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('common.retry', 'حاول مرة أخرى')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-3">
            {emptyIcon}
            <p className="text-muted-foreground text-sm">{emptyMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default DashboardContainer;
