import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOB_MONTHS, DOB_YEARS, normalizeDate, daysInMonth, ageFromISO, parseISODate } from "@/utils/dateUtils";

/**
 * Canonical Year/Month/Day date picker used across forms. Stores ISO "YYYY-MM-DD".
 * Translation strings are passed in by the caller so the component stays
 * namespace-agnostic (no internal t() calls → no i18n-key guard impact).
 */
interface Props {
  label: string;
  value: string; // ISO "YYYY-MM-DD" or ""
  onChange: (iso: string) => void;
  phYear?: string;
  phMonth?: string;
  phDay?: string;
  ageLabel?: (age: number) => string;
  id?: string;
  /** Year values to list; defaults to DOB_YEARS (past). Pass a future range
   * for dates like arrival_date so the picker stays the same segmented style. */
  years?: ReadonlyArray<string | number>;
}

export function BirthdayPicker({
  label,
  value,
  onChange,
  phYear = "Year",
  phMonth = "Month",
  phDay = "Day",
  ageLabel,
  id,
  years = DOB_YEARS,
}: Props) {
  const parsed = parseISODate(value);
  const [selYear, setSelYear] = useState(parsed.year);
  const [selMonth, setSelMonth] = useState(parsed.month);
  const [selDay, setSelDay] = useState(parsed.day);

  // Sync inward when the value prop changes externally.
  useEffect(() => {
    const p = parseISODate(value);
    setSelYear(p.year);
    setSelMonth(p.month);
    setSelDay(p.day);
  }, [value]);

  const numDays = daysInMonth(Number(selMonth), Number(selYear));
  const days = Array.from({ length: numDays }, (_, i) => String(i + 1).padStart(2, "0"));

  const tryEmit = (y: string, m: string, d: string) => {
    if (!y || !m || !d) return;
    try {
      onChange(normalizeDate(d, m, y));
    } catch {
      // invalid intermediate combo — wait for the user to correct
    }
  };

  const handleYear = (y: string) => {
    setSelYear(y);
    tryEmit(y, selMonth, selDay);
  };
  const handleMonth = (m: string) => {
    setSelMonth(m);
    const maxD = daysInMonth(Number(m), Number(selYear));
    const clampedDay = selDay && Number(selDay) > maxD ? String(maxD).padStart(2, "0") : selDay;
    if (clampedDay !== selDay) setSelDay(clampedDay);
    tryEmit(selYear, m, clampedDay);
  };
  const handleDay = (d: string) => {
    setSelDay(d);
    tryEmit(selYear, selMonth, d);
  };

  const age = ageFromISO(value);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="grid grid-cols-3 gap-2 mt-1">
        <Select value={selYear} onValueChange={handleYear}>
          <SelectTrigger id={id ? `${id}-year` : undefined}>
            <SelectValue placeholder={phYear} />
          </SelectTrigger>
          <SelectContent className="max-h-48">
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selMonth} onValueChange={handleMonth}>
          <SelectTrigger>
            <SelectValue placeholder={phMonth} />
          </SelectTrigger>
          <SelectContent>
            {DOB_MONTHS.map((m) => (
              <SelectItem key={m.v} value={m.v}>
                {m.l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selDay} onValueChange={handleDay}>
          <SelectTrigger>
            <SelectValue placeholder={phDay} />
          </SelectTrigger>
          <SelectContent className="max-h-48">
            {days.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {age !== null && ageLabel && (
        <p className="text-xs text-muted-foreground mt-1">{ageLabel(age)}</p>
      )}
    </div>
  );
}

export default BirthdayPicker;
