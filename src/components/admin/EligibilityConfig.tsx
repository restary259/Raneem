import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Save, RotateCcw, AlertTriangle } from 'lucide-react';

interface WeightRow {
  id: string;
  field_name: string;
  label: string;
  weight: number;
  is_active: boolean;
}

interface Thresholds {
  id: string;
  eligible_min: number;
  review_min: number;
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  passport_valid: 15, proof_of_funds: 15, language_level: 10, education_level: 10,
  no_visa_rejection: 10, age_range: 5, motivation: 10, course_alignment: 10,
  verified_contact: 10, arab48_flag: 5,
};

const EligibilityConfig: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: wData }, { data: tData }] = await Promise.all([
      (supabase as any).from('eligibility_config').select('*').order('field_name'),
      (supabase as any).from('eligibility_thresholds').select('*').limit(1),
    ]);
    if (wData) setWeights(wData);
    if (tData?.[0]) setThresholds(tData[0]);
    setLoading(false);
  };

  const totalWeight = weights.filter(w => w.is_active).reduce((s, w) => s + w.weight, 0);

  const handleSave = async () => {
    setSaving(true);
    for (const w of weights) {
      await (supabase as any).from('eligibility_config').update({ weight: w.weight, is_active: w.is_active }).eq('id', w.id);
    }
    if (thresholds) {
      await (supabase as any).from('eligibility_thresholds').update({
        eligible_min: thresholds.eligible_min, review_min: thresholds.review_min,
      }).eq('id', thresholds.id);
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await (supabase as any).from('admin_audit_log').insert({
        admin_id: session.user.id, action: 'update_eligibility_config',
        details: `Weights: ${JSON.stringify(weights.map(w => ({ f: w.field_name, w: w.weight, a: w.is_active })))}. Thresholds: eligible=${thresholds?.eligible_min}, review=${thresholds?.review_min}`,
      });
    }
    setSaving(false);
    toast({ title: t('admin.eligibility.saved') });
  };

  const handleReset = async () => {
    for (const w of weights) {
      const defaultW = DEFAULT_WEIGHTS[w.field_name] ?? 10;
      await (supabase as any).from('eligibility_config').update({ weight: defaultW, is_active: true }).eq('id', w.id);
    }
    if (thresholds) {
      await (supabase as any).from('eligibility_thresholds').update({ eligible_min: 70, review_min: 40 }).eq('id', thresholds.id);
    }
    setShowReset(false);
    toast({ title: t('admin.eligibility.resetDone') });
    fetchData();
  };

  if (loading) return <p className="text-center text-muted-foreground py-8">{t('common.loading')}</p>;

  return (
    <div className="space-y-6">
      {/* Weights */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-bold text-base">{t('admin.eligibility.weightsTitle')}</h3>
          <div className="space-y-2">
            {weights.map((w, i) => (
              <div key={w.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <Switch checked={w.is_active} onCheckedChange={v => {
                  const next = [...weights]; next[i] = { ...w, is_active: v }; setWeights(next);
                }} />
                <span className="text-sm flex-1 min-w-0 truncate">{w.label || w.field_name}</span>
                <Input
                  type="number" min={0} max={100}
                  value={w.weight}
                  onChange={e => {
                    const next = [...weights]; next[i] = { ...w, weight: Number(e.target.value) || 0 }; setWeights(next);
                  }}
                  className="w-20 text-center"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-sm font-medium">{t('admin.eligibility.total')}</span>
            <Badge variant={totalWeight === 100 ? 'default' : 'destructive'} className="text-sm">
              {totalWeight}/100
            </Badge>
            {totalWeight !== 100 && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" />{t('admin.eligibility.weightWarning')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Thresholds */}
      {thresholds && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-bold text-base">{t('admin.eligibility.thresholdsTitle')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('admin.eligibility.eligibleMin')}</label>
                <Input type="number" value={thresholds.eligible_min} onChange={e => setThresholds({ ...thresholds, eligible_min: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('admin.eligibility.reviewMin')}</label>
                <Input type="number" value={thresholds.review_min} onChange={e => setThresholds({ ...thresholds, review_min: Number(e.target.value) || 0 })} />
              </div>
            </div>
            {/* Visual bar */}
            <div className="h-4 rounded-full overflow-hidden flex">
              <div className="bg-red-400" style={{ width: `${thresholds.review_min}%` }} />
              <div className="bg-amber-400" style={{ width: `${thresholds.eligible_min - thresholds.review_min}%` }} />
              <div className="bg-emerald-400" style={{ width: `${100 - thresholds.eligible_min}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t('admin.eligibility.notEligible')} (&lt;{thresholds.review_min})</span>
              <span>{t('admin.eligibility.review')} ({thresholds.review_min}–{thresholds.eligible_min - 1})</span>
              <span>{t('admin.eligibility.eligible')} (≥{thresholds.eligible_min})</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 me-1" />{saving ? t('common.loading') : t('admin.eligibility.save')}
        </Button>
        <Button variant="outline" onClick={() => setShowReset(true)}>
          <RotateCcw className="h-4 w-4 me-1" />{t('admin.eligibility.reset')}
        </Button>
      </div>

      <AlertDialog open={showReset} onOpenChange={setShowReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.eligibility.resetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.eligibility.resetDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>{t('admin.eligibility.resetConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EligibilityConfig;
