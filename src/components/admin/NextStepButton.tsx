import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { getNextSteps, canTransition } from '@/lib/caseTransitions';
import { CaseStatus } from '@/lib/caseStatus';
import { ChevronRight } from 'lucide-react';

interface NextStepButtonProps {
  caseId: string;
  currentStatus: string;
  onStatusUpdated?: (newStatus: string) => void;
  /** Extra data to include in the update (e.g. paid_at) */
  extraUpdate?: Record<string, any>;
  size?: 'sm' | 'default';
}

const NextStepButton: React.FC<NextStepButtonProps> = ({
  caseId,
  currentStatus,
  onStatusUpdated,
  extraUpdate,
  size = 'sm',
}) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const nextSteps = getNextSteps(currentStatus);

  if (nextSteps.length === 0) return null;

  const primaryNext = nextSteps[0];

  const updateStatus = async (target: CaseStatus) => {
    if (!canTransition(currentStatus, target)) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: `Cannot transition from ${currentStatus} to ${target}`,
      });
      return;
    }

    setLoading(true);
    const updateData: Record<string, any> = {
      case_status: target,
      ...extraUpdate,
    };

    // Auto-set paid_at when moving to paid
    if (target === CaseStatus.PAID) {
      updateData.paid_at = new Date().toISOString();
    }

    const { error } = await (supabase as any)
      .from('student_cases')
      .update(updateData)
      .eq('id', caseId);

    if (error) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    } else {
      toast({ title: t('lawyer.saved'), description: `→ ${t(`cases.statuses.${target}`, target.replace(/_/g, ' '))}` });
      onStatusUpdated?.(target);
    }
    setLoading(false);
  };

  const label = t(`cases.statuses.${primaryNext}`, primaryNext.replace(/_/g, ' '));

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size={size}
        onClick={() => updateStatus(primaryNext)}
        disabled={loading}
        className="gap-1 active:scale-95"
      >
        <ChevronRight className="h-3.5 w-3.5" />
        {loading ? t('common.loading') : label}
      </Button>
      {nextSteps.length > 1 && (
        <Select onValueChange={(v) => updateStatus(v as CaseStatus)}>
          <SelectTrigger className={`${size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'} p-0 justify-center`}>
            <span className="text-xs">…</span>
          </SelectTrigger>
          <SelectContent>
            {nextSteps.slice(1).map((s) => (
              <SelectItem key={s} value={s}>
                {t(`cases.statuses.${s}`, s.replace(/_/g, ' '))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export default NextStepButton;
