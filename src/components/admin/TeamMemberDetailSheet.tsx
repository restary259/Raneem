import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatILS } from '@/lib/money';

interface Stats {
  assigned: number;
  enrolled: number;
  referred: number;
  earned: number;
  paid: number;
  pending: number;
  lastActivity: string | null;
}

interface Props {
  memberId: string | null;
  memberName: string;
  memberEmail: string;
  role: string;
  roleLabel: string;
  commission: number;
  onOpenChange: (open: boolean) => void;
}

const ENROLLED = 'enrolled';

/** Read-only performance snapshot for a single staff account. */
const TeamMemberDetailSheet: React.FC<Props> = ({
  memberId,
  memberName,
  memberEmail,
  role,
  roleLabel,
  commission,
  onOpenChange,
}) => {
  const { t } = useTranslation('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [assignedRes, referredRes, rewardsRes] = await Promise.all([
        (supabase as any)
          .from('cases')
          .select('status, last_activity_at')
          .eq('assigned_to', id)
          .is('deleted_at', null),
        (supabase as any)
          .from('cases')
          .select('status')
          .eq('partner_id', id)
          .is('deleted_at', null),
        (supabase as any).from('rewards').select('amount, status').eq('user_id', id),
      ]);

      const assigned = assignedRes.data || [];
      const referred = referredRes.data || [];
      const rewards = rewardsRes.data || [];
      const sum = (rows: any[]) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

      setStats({
        assigned: assigned.length,
        enrolled:
          role === 'team_member'
            ? assigned.filter((c: any) => c.status === ENROLLED).length
            : referred.filter((c: any) => c.status === ENROLLED).length,
        referred: referred.length,
        earned: sum(rewards),
        paid: sum(rewards.filter((r: any) => r.status === 'paid')),
        pending: sum(rewards.filter((r: any) => r.status !== 'paid')),
        lastActivity:
          assigned
            .map((c: any) => c.last_activity_at)
            .filter(Boolean)
            .sort()
            .pop() ?? null,
      });
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (memberId) load(memberId);
    else setStats(null);
  }, [memberId, load]);

  const isPartner = role !== 'team_member';

  const rows: { label: string; value: string }[] = stats
    ? [
        isPartner
          ? { label: t('admin.team.stats.referred', 'Referred students'), value: String(stats.referred) }
          : { label: t('admin.team.stats.assigned', 'Assigned cases'), value: String(stats.assigned) },
        { label: t('admin.team.stats.enrolled', 'Enrolled'), value: String(stats.enrolled) },
        { label: t('admin.team.stats.perStudent', 'Per enrolled student'), value: formatILS(commission) },
        { label: t('admin.team.stats.earned', 'Total earned'), value: formatILS(stats.earned) },
        { label: t('admin.team.stats.paid', 'Paid out'), value: formatILS(stats.paid) },
        { label: t('admin.team.stats.pending', 'Pending'), value: formatILS(stats.pending) },
        {
          label: t('admin.team.stats.lastActivity', 'Last case activity'),
          value: stats.lastActivity ? new Date(stats.lastActivity).toLocaleDateString('en-US') : '—',
        },
      ]
    : [];

  return (
    <Sheet open={!!memberId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-start">
          <SheetTitle className="flex items-center gap-2">
            {memberName}
            <Badge variant="secondary">{roleLabel}</Badge>
          </SheetTitle>
          <SheetDescription>{memberEmail}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {loading || !stats
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            : rows.map(r => (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <span className="text-sm font-medium text-foreground">{r.value}</span>
                </div>
              ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TeamMemberDetailSheet;
