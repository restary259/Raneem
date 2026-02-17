import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ReferralTrackerProps {
  userId: string;
}

const ReferralTracker: React.FC<ReferralTrackerProps> = ({ userId }) => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const { t, i18n } = useTranslation('dashboard');

  const STATUS_MAP: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { variant: 'secondary' },
    contacted: { variant: 'outline' },
    enrolled: { variant: 'default' },
    paid: { variant: 'default' },
    rejected: { variant: 'destructive' },
  };

  useEffect(() => {
    const fetch = async () => {
      const { data } = await (supabase as any)
        .from('referrals')
        .select('*')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });
      if (data) setReferrals(data);
    };
    fetch();
  }, [userId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-primary" />
          {t('referrals.trackerTitle', { count: referrals.length })}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {referrals.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">{t('referrals.noReferrals')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('referrals.name')}</th>
                  <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('referrals.status')}</th>
                  <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('referrals.family')}</th>
                  <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('referrals.date')}</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map(r => {
                  const status = STATUS_MAP[r.status] || STATUS_MAP.pending;
                  return (
                    <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{r.referred_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><Badge variant={status.variant}>{String(t(`referrals.statuses.${r.status}`, { defaultValue: r.status }))}</Badge></td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.is_family ? t('referrals.familyYes') : '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-US')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReferralTracker;
