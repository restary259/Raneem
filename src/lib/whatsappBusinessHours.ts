export const DARB_TIME_ZONE = "Asia/Jerusalem";

const OPEN_WEEKDAYS = new Set([0, 1, 2, 3, 4]); // Sunday–Thursday

export function getDarbBusinessHours(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DARB_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const minutes = hour * 60 + minute;
  const open = OPEN_WEEKDAYS.has(dayIndex) && minutes >= 10 * 60 && minutes < 19 * 60;
  return { open, dayIndex, minutes, openMinutes: 10 * 60, closeMinutes: 19 * 60 };
}

export function isDarbBusinessHours(now = new Date()) {
  return getDarbBusinessHours(now).open;
}
