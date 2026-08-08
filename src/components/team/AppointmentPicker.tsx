import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BusySlot {
  start: Date;
  end: Date;
}

interface AppointmentPickerProps {
  teamMemberId?: string | null;
  value: Date | null;
  onChange: (next: Date) => void;
  durationMinutes: number;
  ignoreAppointmentId?: string | null;
  onConflictChange?: (hasConflict: boolean) => void;
}

const DAY_WINDOW = 14;
const SLOT_MINUTES = 30;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;

const AppointmentPicker: React.FC<AppointmentPickerProps> = ({
  teamMemberId,
  value,
  onChange,
  durationMinutes,
  ignoreAppointmentId,
  onConflictChange,
}) => {
  const { t, i18n } = useTranslation("dashboard");

  const locale = i18n.language === "ar" ? "ar-u-nu-latn-ca-gregory" : "en-US";

  const [rangeStart, setRangeStart] = useState<Date>(() => startOfDay(value ?? new Date()));

  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(value ?? new Date()));

  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value) return;

    const nextDay = startOfDay(value);

    setSelectedDay(nextDay);

    setRangeStart((prev) => (nextDay < prev ? nextDay : prev));
  }, [value?.getTime()]);

  const days = useMemo(() => Array.from({ length: DAY_WINDOW }, (_, i) => addDays(rangeStart, i)), [rangeStart]);

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
        .from("appointments")
        .select("id, scheduled_at, duration_minutes")
        .eq("team_member_id", teamMemberId)
        .gte("scheduled_at", from)
        .lt("scheduled_at", to);

      if (error) throw error;

      const slots: BusySlot[] = (data || [])
        .filter((a: any) => a.id !== ignoreAppointmentId)
        .map((a: any) => {
          const start = new Date(a.scheduled_at);

          return {
            start,
            end: new Date(start.getTime() + (a.duration_minutes || 30) * 60000),
          };
        });

      setBusy(slots);
    } catch {
      setBusy([]);
    } finally {
      setLoading(false);
    }
  }, [teamMemberId, selectedDay, ignoreAppointmentId]);

  useEffect(() => {
    loadBusy();
  }, [loadBusy]);

  const slots = useMemo(() => {
    const result: Date[] = [];
    const base = startOfDay(selectedDay);

    for (let minutes = DAY_START_HOUR * 60; minutes < DAY_END_HOUR * 60; minutes += SLOT_MINUTES) {
      result.push(new Date(base.getTime() + minutes * 60000));
    }

    return result;
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
  }, [value?.getTime(), overlaps, onConflictChange]);

  const now = new Date();

  return (
    <div className="w-full min-w-0 max-w-full space-y-3 overflow-hidden">
      {/* DAY NAVIGATION */}
      <div className="flex w-full min-w-0 max-w-full items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setRangeStart((d) => addDays(d, -DAY_WINDOW))}
          aria-label={t("lawyer.picker.previousDays", "Previous days")}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>

        {/* IMPORTANT:
            min-w-0 allows this container to shrink.
            overflow-x-auto contains the day buttons.
        */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className="flex w-full min-w-0 gap-1.5 overflow-x-auto pb-1"
            style={{
              scrollbarWidth: "thin",
            }}
          >
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
                    // IMPORTANT:
                    // shrink-0 keeps each day button intact
                    "flex h-[68px] w-[60px] shrink-0 flex-col items-center justify-center rounded-xl border px-2 py-1.5 transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted",
                    past && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wide">
                    {d.toLocaleDateString(locale, {
                      weekday: "short",
                    })}
                  </span>

                  <span className="text-lg font-semibold leading-tight">
                    {d.toLocaleDateString("en-US", {
                      day: "numeric",
                    })}
                  </span>

                  <span className="text-[10px]">
                    {d.toLocaleDateString(locale, {
                      month: "short",
                    })}
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
          aria-label={t("lawyer.picker.nextDays", "Next days")}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>

      {/* TIME GRID */}
      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border bg-muted/20 p-2">
        <div className="mb-2 flex min-w-0 items-center justify-between px-1">
          <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">
            {selectedDay.toLocaleDateString(locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>

          {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
        </div>

        <div className="grid w-full min-w-0 grid-cols-3 gap-1.5 overflow-y-auto pe-1 sm:grid-cols-4 md:grid-cols-6">
          {slots.map((s) => {
            const taken = overlaps(s);
            const past = s < now;

            const active = value && s.getTime() === value.getTime();

            return (
              <button
                key={s.toISOString()}
                type="button"
                disabled={taken || past}
                onClick={() => onChange(s)}
                title={taken ? t("lawyer.picker.booked", "Already booked") : undefined}
                className={cn(
                  "min-w-0 rounded-lg border px-1 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted",
                  (taken || past) && "cursor-not-allowed opacity-35 line-through hover:bg-background",
                )}
              >
                {format(s, "HH:mm")}
              </button>
            );
          })}
        </div>
      </div>

      {/* SELECTED SLOT */}
      {value && (
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {t("lawyer.picker.selected", "Selected")}:{" "}
          <span className="font-medium text-foreground">
            {value.toLocaleDateString(locale, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}{" "}
            · {format(value, "HH:mm")}
          </span>
        </p>
      )}
    </div>
  );
};

export default AppointmentPicker;
