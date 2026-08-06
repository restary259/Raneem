import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BusySlot {
  start: Date;
  end: Date;
}

interface AppointmentPickerProps {
  /** Team member whose calendar is being booked. */
  teamMemberId?: string | null;
  /** Currently selected slot (Date) or null. */
  value: Date | null;
  onChange: (next: Date) => void;
  /** Duration in minutes of the appointment being booked. */
  durationMinutes: number;
  /** Appointment id to ignore when checking conflicts (rescheduling). */
  ignoreAppointmentId?: string | null;
  /** Fires whenever the selected slot overlaps an existing appointment. */
  onConflictChange?: (hasConflict: boolean) => void;
}

const DAY_WINDOW = 14;
const SLOT_MINUTES = 30;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;

/**
 * Unified scheduling surface: a scrollable day strip plus a tappable time grid
 * that greys out slots the team member is already booked for.
 * One tap on a day + one tap on a slot is a complete selection.
 */
const AppointmentPicker: React.FC<AppointmentPickerProps> = ({
  teamMemberId,
  value,
  onChange,
  durationMinutes,
  ignoreAppointmentId,
  onConflictChange,
}) => {
  const { t, i18n } = useTranslation('dashboard');
  const locale = i18n.language === 'ar' ? 'ar-u-nu-latn-ca-gregory' : 'en-US';

  const [rangeStart, setRangeStart] = useState<Date>(() => startOfDay(value ?? new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(value ?? new Date()));
  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value) {
      setSelectedDay(startOfDay(value));
      setRangeStart((prev) => (startOfDay(value) < prev ? startOfDay(value) : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.getTime()]);

  const days = useMemo(
    () => Array.from({ length: DAY_WINDOW }, (_, i) => addDays(rangeStart, i)),
    [rangeStart],
  );

  const loadBusy = useCallback(async () => {
    if (!teamMemberId) {
      setBusy([]);
      return;
    }
    setLoading(true);
    try {
      const from = startOfDay(selectedDay).toISOString();
      const to = addDays(startOfDay(selectedDay), 1).toISOString();
      const { data, error } = await (supabase as any)
        .from('appointments')
        .select('id, scheduled_at, duration_minutes')
        .eq('team_member_id', teamMemberId)
        .gte('scheduled_at', from)
        .lt('scheduled_at', to);
      if (error) throw error;
      const slots: BusySlot[] = (data || [])
        .filter((a: any) => a.id !== ignoreAppointmentId)
        .map((a: any) => {
          const start = new Date(a.scheduled_at);
          return { start, end: new Date(start.getTime() + (a.duration_minutes || 30) * 60000) };
        });
      setBusy(slots);
    } catch {
      setBusy([]);
    } finally {
      setLoading(false);
    }
  }, [teamMemberId, selectedDay, ignoreAppointmentId]);

  useEffect(() => { loadBusy(); }, [loadBusy]);

  const slots = useMemo(() => {
    const out: Date[] = [];
    const base = startOfDay(selectedDay);
    for (let m = DAY_START_HOUR * 60; m < DAY_END_HOUR * 60; m += SLOT_MINUTES) {
      out.push(new Date(base.getTime() + m * 60000));
    }
    return out;
  }, [selectedDay]);

  const overlaps = useCallback(
    (start: Date) => {
      const end = new Date(start.getTime() + durationMinutes * 60000);
      return busy.some((b) => start < b.end && end > b.start);
    },
    [busy, durationMinutes],
  );

  useEffect(() => {
    onConflictChange?.(value ? overlaps(value) : false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.getTime(), overlaps]);

  const now = new Date();

  return (
    <div className="space-y-3">
      {/* Day strip */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setRangeStart((d) => addDays(d, -DAY_WINDOW))}
          aria-label={t('lawyer.picker.previousDays', 'Previous days')}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>

        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1.5 pb-1">
            {days.map((d) => {
              const active = isSameDay(d, selectedDay);
              const past = d < startOfDay(now);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={past}
                  onClick={() => setSelectedDay(startOfDay(d))}
                  className={cn(
                    'flex min-w-[3.25rem] flex-col items-center rounded-xl border px-2 py-1.5 transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted',
                    past && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wide">
                    {d.toLocaleDateString(locale, { weekday: 'short' })}
                  </span>
                  <span className="text-lg font-semibold leading-tight">
                    {d.toLocaleDateString('en-US', { day: 'numeric' })}
                  </span>
                  <span className="text-[10px]">
                    {d.toLocaleDateString(locale, { month: 'short' })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setRangeStart((d) => addDays(d, DAY_WINDOW))}
          aria-label={t('lawyer.picker.nextDays', 'Next days')}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>

      {/* Time grid */}
      <div className="rounded-xl border bg-muted/20 p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted-foreground">
            {selectedDay.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto pe-1 sm:grid-cols-6">
          {slots.map((s) => {
            const taken = overlaps(s);
            const past = s < now;
            const active = value ? s.getTime() === value.getTime() : false;
            return (
              <button
                key={s.toISOString()}
                type="button"
                disabled={taken || past}
                onClick={() => onChange(s)}
                title={taken ? t('lawyer.picker.booked', 'Already booked') : undefined}
                className={cn(
                  'rounded-lg border py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted',
                  (taken || past) && 'cursor-not-allowed opacity-35 line-through hover:bg-background',
                )}
              >
                {format(s, 'HH:mm')}
              </button>
            );
          })}
        </div>
      </div>

      {value && (
        <p className="text-xs text-muted-foreground">
          {t('lawyer.picker.selected', 'Selected')}:{' '}
          <span className="font-medium text-foreground">
            {value.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })} · {format(value, 'HH:mm')}
          </span>
        </p>
      )}
    </div>
  );
};

export default AppointmentPicker;
