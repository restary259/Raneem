import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ar } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";

function CalendarPreview() {
  const [day, setDay] = useState<Date | undefined>(new Date());
  const [dayAr, setDayAr] = useState<Date | undefined>(new Date());
  const available = new Set([3, 5, 8, 12, 15, 19, 22, 26].map((d) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    return dt.toDateString();
  }));
  return (
    <div className="flex flex-wrap gap-10 p-10" dir="ltr">
      <div>
        <p className="mb-2 text-sm font-semibold">English</p>
        <Calendar
          mode="single"
          selected={day}
          onSelect={setDay}
          className="rounded-md border"
        />
      </div>
      <div dir="rtl">
        <p className="mb-2 text-sm font-semibold">Arabic RTL + available-days-only (booking style)</p>
        <Calendar
          mode="single"
          locale={ar}
          numerals="latn"
          dir="rtl"
          selected={dayAr}
          onSelect={setDayAr}
          disabled={(d) => !available.has(d.toDateString())}
          showOutsideDays={false}
          className="rounded-md border"
        />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/calendar-preview")({
  component: CalendarPreview,
});
