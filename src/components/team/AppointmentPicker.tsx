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
  /** Team member whose calendar is being booked. */
  teamMemberId?: string | null;

  /** Currently selected slot. */
  value: Date | null;

  /** Called when a time slot is selected. */
  onChange: (next: Date) => void;

  /** Duration of the appointment in minutes. */
  durationMinutes: number;

  /** Appointment ID to ignore when checking conflicts during rescheduling. */
  ignoreAppointmentId?: string | null;

  /** Called whenever the selected slot conflicts with an existing appointment. */
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

  /**
   * Keep Arabic numerals in Latin form so dates/times remain
   * consistent throughout the dashboard.
   */
  const locale = i18n.language === "ar" ? "ar-u-nu-latn-ca-gregory" : "en-US";

  const [rangeStart, setRangeStart] = useState<Date>(() => startOfDay(value ?? new Date()));

  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(value ?? new Date()));

  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Keep the selected day synchronized with the selected value.
   */
  useEffect(() => {
    if (!value) return;

    const nextDay = startOfDay(value);

    setSelectedDay(nextDay);

    setRangeStart((previous) => {
      if (nextDay < previous) {
        return nextDay;
      }

      return previous;
    });
  }, [value?.getTime()]);

  /**
   * Generate the visible 14-day window.
   */
  const days = useMemo(() => {
    return Array.from({ length: DAY_WINDOW }, (_, index) => addDays(rangeStart, index));
  }, [rangeStart]);

  /**
   * Load existing appointments for the selected team member
   * and selected day.
   */
  const loadBusy = useCallback(async () => {
    if (!teamMemberId) {
      setBusy([]);
      return;
    }

    setLoading(true);

    try {
      const dayStart = startOfDay(selectedDay);

      const from = dayStart.toISOString();

      const to = addDays(dayStart, 1).toISOString();

      const { data, error } = await (supabase as any)
        .from("appointments")
        .select("id, scheduled_at, duration_minutes")
        .eq("team_member_id", teamMemberId)
        .gte("scheduled_at", from)
        .lt("scheduled_at", to);

      if (error) {
        throw error;
      }

      const busySlots: BusySlot[] = (data || [])
        .filter((appointment: any) => appointment.id !== ignoreAppointmentId)
        .map((appointment: any) => {
          const start = new Date(appointment.scheduled_at);

          const duration = appointment.duration_minutes || 30;

          return {
            start,
            end: new Date(start.getTime() + duration * 60000),
          };
        });

      setBusy(busySlots);
    } catch {
      setBusy([]);
    } finally {
      setLoading(false);
    }
  }, [teamMemberId, selectedDay, ignoreAppointmentId]);

  useEffect(() => {
    loadBusy();
  }, [loadBusy]);

  /**
   * Generate 30-minute appointment slots.
   */
  const slots = useMemo(() => {
    const result: Date[] = [];

    const base = startOfDay(selectedDay);

    for (let minutes = DAY_START_HOUR * 60; minutes < DAY_END_HOUR * 60; minutes += SLOT_MINUTES) {
      result.push(new Date(base.getTime() + minutes * 60000));
    }

    return result;
  }, [selectedDay]);

  /**
   * Determine whether an appointment starting at `start`
   * overlaps an existing appointment.
   */
  const overlaps = useCallback(
    (start: Date) => {
      const end = new Date(start.getTime() + durationMinutes * 60000);

      return busy.some((busySlot) => start < busySlot.end && end > busySlot.start);
    },
    [busy, durationMinutes],
  );

  /**
   * Notify parent about conflicts.
   */
  useEffect(() => {
    onConflictChange?.(value ? overlaps(value) : false);
  }, [value?.getTime(), overlaps, onConflictChange]);

  const now = new Date();

  return (
    <div
      className="
        w-full
        min-w-0
        max-w-full
        space-y-3
        overflow-hidden
      "
    >
      {/* =========================================================
          DAY NAVIGATION
          ========================================================= */}

      <div
        className="
          grid
          w-full
          min-w-0
          max-w-full
          grid-cols-[32px_minmax(0,1fr)_32px]
          items-center
          gap-1
          overflow-hidden
        "
      >
        {/* Previous days */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={addDays(rangeStart, -DAY_WINDOW) < startOfDay(new Date())}
          onClick={() => setRangeStart((date) => {
            const prev = addDays(date, -DAY_WINDOW);
            return prev < startOfDay(new Date()) ? startOfDay(new Date()) : prev;
          })}
          aria-label={t("lawyer.picker.previousDays", "Previous days")}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>

        {/* =====================================================
            DAY VIEWPORT

            This container is intentionally constrained.

            The 14 date buttons live inside a horizontally
            scrollable track and can NEVER increase the width
            of the parent component.
            ===================================================== */}

        <div
          className="
            min-w-0
            max-w-full
            overflow-hidden
          "
        >
          <div
            className="
              flex
              w-full
              max-w-full
              min-w-0
              gap-1.5
              overflow-x-auto
              overflow-y-hidden
              pb-1
            "
            style={{
              scrollbarWidth: "thin",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {days.map((day) => {
              const active = isSameDay(day, selectedDay);

              const past = day < startOfDay(now);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={past}
                  onClick={() => setSelectedDay(startOfDay(day))}
                  className={cn(
                    /*
                     * Fixed dimensions are intentional.
                     *
                     * shrink-0 prevents flexbox from
                     * changing the size of the date cards.
                     */
                    "box-border flex h-[68px] w-[60px] min-w-[60px] max-w-[60px] shrink-0 flex-none flex-col items-center justify-center rounded-xl border px-1.5 py-1.5",

                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted",

                    past && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span
                    className="
                      w-full
                      truncate
                      text-center
                      text-[10px]
                      uppercase
                      tracking-wide
                    "
                  >
                    {day.toLocaleDateString(locale, {
                      weekday: "short",
                    })}
                  </span>

                  <span
                    className="
                      text-lg
                      font-semibold
                      leading-tight
                    "
                  >
                    {day.toLocaleDateString("en-US", {
                      day: "numeric",
                    })}
                  </span>

                  <span
                    className="
                      w-full
                      truncate
                      text-center
                      text-[10px]
                    "
                  >
                    {day.toLocaleDateString(locale, {
                      month: "short",
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Next days */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setRangeStart((date) => addDays(date, DAY_WINDOW))}
          aria-label={t("lawyer.picker.nextDays", "Next days")}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>

      {/* =========================================================
          TIME GRID
          ========================================================= */}

      <div
        className="
          w-full
          min-w-0
          max-w-full
          overflow-hidden
          rounded-xl
          border
          bg-muted/20
          p-2
        "
      >
        {/* Selected day heading */}
        <div
          className="
            mb-2
            flex
            min-w-0
            items-center
            justify-between
            gap-2
            px-1
          "
        >
          <span
            className="
              min-w-0
              truncate
              text-xs
              font-medium
              text-muted-foreground
            "
          >
            {selectedDay.toLocaleDateString(locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>

          {loading && (
            <Loader2
              className="
                h-3.5
                w-3.5
                shrink-0
                animate-spin
                text-muted-foreground
              "
            />
          )}
        </div>

        {/* Time slots */}
        <div
          className="
            grid
            w-full
            min-w-0
            max-w-full
            grid-cols-3
            gap-1.5
            overflow-y-auto
            overflow-x-hidden
            pe-1
            sm:grid-cols-4
            md:grid-cols-6
          "
          style={{
            maxHeight: "224px",
          }}
        >
          {slots.map((slot) => {
            const taken = overlaps(slot);

            const past = slot < now;

            const active = value && slot.getTime() === value.getTime();

            return (
              <button
                key={slot.toISOString()}
                type="button"
                disabled={taken || past}
                onClick={() => onChange(slot)}
                title={taken ? t("lawyer.picker.booked", "Already booked") : undefined}
                className={cn(
                  /*
                   * min-w-0 prevents the button text
                   * from affecting the grid width.
                   */
                  "min-w-0 max-w-full overflow-hidden rounded-lg border px-1 py-1.5 text-xs font-medium transition-colors",

                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted",

                  (taken || past) && "cursor-not-allowed opacity-35 line-through hover:bg-background",
                )}
              >
                <span className="block truncate">{format(slot, "HH:mm")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================
          SELECTED SLOT
          ========================================================= */}

      {value && (
        <p
          className="
            min-w-0
            max-w-full
            truncate
            text-xs
            text-muted-foreground
          "
        >
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
