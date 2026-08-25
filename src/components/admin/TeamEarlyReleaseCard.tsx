import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Zap, Loader2 } from 'lucide-react';
import AdminPasswordConfirm from './AdminPasswordConfirm';
import { useEarlyRelease } from '@/hooks/useEarlyRelease';

interface Props {
  memberId: string;
  memberName: string;
  onReleased: () => void;
}

const fmt = (n: number) => `${Number(n || 0).toLocaleString('en-US')} ₪`;

/**
 * Admin-only early payout release for team members: pays selected locked
 * rewards immediately instead of waiting out the 20-day hold. Gated by the
 * admin password gate and a required note; the RPC re-checks both the admin
 * role and that the target is a team member.
 */
const TeamEarlyReleaseCard: React.FC<Props> = ({ memberId, memberName, onReleased }) => {
  const { t, i18n } = useTranslation('dashboard');
  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
  const { rewards, loading, submitting, release } = useEarlyRelease(memberId);

  const [selected, setSelected] = useState<string[]>([]);
  const [pwOpen, setPwOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState('');

  const total = useMemo(
    () => rewards.filter(r => selected.includes(r.reward_id)).reduce((s, r) => s + Number(r.amount || 0), 0),
    [rewards, selected],
  );

  const toggle = (id: string) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const doRelease = async () => {
    const ok = await release(selected, note);
    if (ok) {
      setSelected([]);
      setNote('');
      setConfirmOpen(false);
      onReleased();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-600" />
          {t('admin.payouts.earlyRelease.title', 'Locked rewards (early release)')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          {t('admin.payouts.earlyRelease.hint', 'Pay selected commissions now instead of waiting for the 20-day hold. Team members only.')}
        </p>

        {loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t('common.loading', 'Loading…')}
          </p>
        ) : rewards.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t('admin.payouts.earlyRelease.empty', 'No locked rewards for this member')}
          </p>
        ) : (
          <>
            <div className="divide-y divide-border">
              {rewards.map(r => (
                <label key={r.reward_id} className="flex items-center gap-3 p-4 cursor-pointer">
                  <Checkbox
                    checked={selected.includes(r.reward_id)}
                    onCheckedChange={() => toggle(r.reward_id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {r.student_name || t('admin.payouts.unknownRequester', 'Unknown')}
                      {r.case_reference ? ` · ${r.case_reference}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('admin.payouts.earlyRelease.unlocksOn', 'Unlocks on')}{' '}
                      {new Date(r.unlock_at).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold whitespace-nowrap">{fmt(Number(r.amount))}</p>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
              <p className="text-sm">
                {t('admin.payouts.earlyRelease.selectedTotal', 'Selected total')}:{' '}
                <span className="font-semibold">{fmt(total)}</span>
              </p>
              <Button
                size="sm"
                className="gap-2"
                disabled={selected.length === 0 || submitting}
                onClick={() => setPwOpen(true)}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {t('admin.payouts.earlyRelease.action', 'Release & pay now')}
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <AdminPasswordConfirm
        open={pwOpen}
        reason={t('admin.payouts.earlyRelease.confirmReason', 'You are about to pay locked commissions immediately, bypassing the 20-day hold.')}
        onCancel={() => setPwOpen(false)}
        onConfirmed={() => { setPwOpen(false); setConfirmOpen(true); }}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.payouts.earlyRelease.confirmTitle', 'Release payout early?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.payouts.earlyRelease.confirmBody', 'This marks the selected rewards as paid and records a paid payout for this member.')}
              {' '}{memberName} · {fmt(total)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="early-release-note">
              {t('admin.payouts.earlyRelease.note', 'Reason (required)')}
            </Label>
            <Textarea
              id="early-release-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!note.trim() || submitting}
              onClick={(e) => { e.preventDefault(); doRelease(); }}
            >
              {t('admin.payouts.earlyRelease.action', 'Release & pay now')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default TeamEarlyReleaseCard;
