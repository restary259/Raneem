import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoadingState, EmptyState, ErrorState, TablePagination, usePagination } from '@/components/shell';

interface ReferralTrackerProps {
  userId: string;
}

const ReferralTracker: React.FC<ReferralTrackerProps> = ({ userId }) => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { t, i18n } = useTranslation('dashboard');

  const STATUS_MAP: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { variant: 'secondary' },
    contacted: { variant: 'outline' },
    enrolled: { variant: 'default' },
    rewarded: { variant: 'default' },
  };

  const fetchReferrals = useCallback(async (ignore = false) => {
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from('referrals')
      .select('*')
      .eq('referrer_user_id', userId)
      .order('created_at', { ascending: false });
    if (ignore) return;
    if (error) setLoadError(error.message);
    else {
      setLoadError(null);
      setReferrals(data ?? []);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    let ignore = false;
    fetchReferrals(ignore);
    return () => {
      ignore = true;
    };
  }, [fetchReferrals]);

  const pagination = usePagination(referrals, 25);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-primary" />
          {t('referrals.trackerTitle', { count: referrals.length })}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4">
            <LoadingState variant="table" rows={3} />
          </div>
        ) : loadError ? (
          <ErrorState
            title={t('common.error', 'Error')}
            description={loadError}
            onRetry={() => fetchReferrals()}
            retryLabel={t('common.retry', 'Retry')}
          />
        ) : referrals.length === 0 ? (
          <EmptyState title={t('referrals.noReferrals')} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('referrals.name')}</th>
                    <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('referrals.status')}</th>
                    <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('referrals.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.items.map(r => {
                    const status = STATUS_MAP[r.status] || STATUS_MAP.pending;
                    return (
                      <tr key={r.id} className="border-b hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{r.referred_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><Badge variant={status.variant}>{String(t(`referrals.statuses.${r.status}`, { defaultValue: r.status }))}</Badge></td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-US')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination pagination={pagination} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ReferralTracker;
