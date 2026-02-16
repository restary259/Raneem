import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';

interface FunnelVisualizationProps {
  leadCounts: Record<string, number>;
  caseCounts: Record<string, number>;
  onStageClick?: (stage: string) => void;
}

const FUNNEL_STAGES = [
  // Intake
  { key: 'new', source: 'lead', colorClass: 'bg-slate-100 text-slate-800 border-slate-200', phase: 'intake' },
  { key: 'eligible', source: 'lead', colorClass: 'bg-cyan-100 text-cyan-800 border-cyan-200', phase: 'intake' },
  // Assignment
  { key: 'assigned', source: 'both', colorClass: 'bg-blue-100 text-blue-800 border-blue-200', phase: 'assignment' },
  { key: 'contacted', source: 'case', colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-200', phase: 'assignment' },
  // Appointment
  { key: 'appointment_scheduled', source: 'case', colorClass: 'bg-purple-100 text-purple-800 border-purple-200', phase: 'appointment' },
  { key: 'appointment_completed', source: 'case', colorClass: 'bg-violet-100 text-violet-800 border-violet-200', phase: 'appointment' },
  // Preparation
  { key: 'profile_filled', source: 'case', colorClass: 'bg-indigo-100 text-indigo-800 border-indigo-200', phase: 'preparation' },
  { key: 'services_filled', source: 'case', colorClass: 'bg-sky-100 text-sky-800 border-sky-200', phase: 'preparation' },
  // Payment
  { key: 'paid', source: 'case', colorClass: 'bg-green-100 text-green-800 border-green-200', phase: 'payment' },
  // Application
  { key: 'ready_to_apply', source: 'case', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200', phase: 'application' },
  { key: 'visa_stage', source: 'case', colorClass: 'bg-amber-100 text-amber-800 border-amber-200', phase: 'application' },
  { key: 'completed', source: 'case', colorClass: 'bg-teal-100 text-teal-800 border-teal-200', phase: 'application' },
];

const FunnelVisualization: React.FC<FunnelVisualizationProps> = ({ leadCounts, caseCounts, onStageClick }) => {
  const { t } = useTranslation('dashboard');

  const getCount = (stage: typeof FUNNEL_STAGES[0]) => {
    if (stage.source === 'lead') return leadCounts[stage.key] || 0;
    if (stage.source === 'case') return caseCounts[stage.key] || 0;
    return (leadCounts[stage.key] || 0) + (caseCounts[stage.key] || 0);
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-center gap-1 min-w-max">
        {FUNNEL_STAGES.map((stage, i) => (
          <React.Fragment key={stage.key}>
            <button
              onClick={() => onStageClick?.(stage.key)}
              className={`flex flex-col items-center px-3 py-2 rounded-xl border transition-all hover:shadow-md hover:scale-105 cursor-pointer ${stage.colorClass}`}
            >
              <span className="text-lg font-bold leading-tight">{getCount(stage)}</span>
              <span className="text-[10px] font-medium whitespace-nowrap mt-0.5">
                {t(`funnel.${stage.key}`, stage.key.replace(/_/g, ' '))}
              </span>
            </button>
            {i < FUNNEL_STAGES.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default FunnelVisualization;
