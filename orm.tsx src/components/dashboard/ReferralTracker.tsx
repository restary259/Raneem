import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ReferralTrackerProps {
  userId: string;
}

const ReferralTracker: React.FC<ReferralTrackerProps> = ({ userId }) => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const { i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

  useEffect(() => {
    const fetchReferrals = async () => {
      // Fixed: correct column is referrer_user_id
      const { data } = await (supabase as any)
        .from('referrals')
        .select('*')
        .eq('referrer_user_id', userId)
        .order('created_at', { ascending: false });
      if (data) setReferrals(data);
    };
    fetchReferrals();
  }, [userId]);

  if (referrals.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-5 w-5 text-primary" />
          {isAr ? `إحالاتي (${referrals.length})` : `My Referrals (${referrals.length})`}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">
                  {isAr ? 'الاسم' : 'Name'}
                </th>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">
                  {isAr ? 'حالة الخصم' : 'Discount'}
                </th>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">
                  {isAr ? 'التاريخ' : 'Date'}
                </th>
              </tr>
            </thead>
            <tbody>
              {referrals.map(r => (
                <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{r.referred_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.discount_applied ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 border">
                        <Tag className="h-3 w-3" />
                        {isAr ? 'تم تطبيق الخصم' : 'Discount Applied'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Tag className="h-3 w-3" />
                        {isAr ? 'خصم قيد الانتظار' : 'Discount Pending'}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString(isAr ? 'ar' : 'en-US')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReferralTracker;
