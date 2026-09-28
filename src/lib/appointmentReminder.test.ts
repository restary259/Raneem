import { describe, it, expect } from "vitest";
import {
  buildReminderContent,
  formatTimeRange,
  formatShortDate,
  reminderTag,
  reminderLink,
  appointmentIdFromLink,
  pushTag,
} from "../../supabase/functions/_shared/appointmentReminder";

/**
 * The reminder content builder is the single source of truth shared by the edge
 * worker and this suite (no duplicated strings to drift). These cases pin the
 * three windows' wording, priority and deep link, plus the per-appointment push
 * identity that keeps two appointments from replacing each other.
 */

// 11:15 Asia/Jerusalem (UTC+3 in October) — the worked example from the spec.
const APPOINTMENT = {
  id: "3f2b8c1e-9a4d-4e2f-8b7c-1d2e3f4a5b6c",
  scheduledAt: "2026-10-07T08:15:00.000Z",
  durationMinutes: 75,
  studentName: "Ataa Ibrahim",
  caseReference: "DARB-1042",
  officeName: "DARB Office",
};

describe("formatTimeRange", () => {
  it("renders start–end in the office timezone with Western digits", () => {
    expect(formatTimeRange(APPOINTMENT.scheduledAt, 75)).toBe("11:15–12:30");
  });

  it("never emits Arabic-Indic digits for an Arabic reader", () => {
    // The helper takes no locale; the output must be locale-independent.
    expect(formatTimeRange(APPOINTMENT.scheduledAt, 60)).toMatch(/^[0-9:–]+$/);
  });
});

describe("formatShortDate", () => {
  it("renders a short weekday/month date for the 24h window", () => {
    expect(formatShortDate(APPOINTMENT.scheduledAt)).toBe("Wed 7 Oct");
  });
});

describe("buildReminderContent", () => {
  it("24h: normal priority, push + email, date+time body", () => {
    const c = buildReminderContent("t_24h", APPOINTMENT);
    expect(c.titleEn).toBe("Appointment tomorrow");
    expect(c.titleAr).toBe("لديك موعد غداً");
    expect(c.priority).toBe("medium");
    expect(c.email).toBe(true);
    expect(c.bodyEn).toBe("Ataa Ibrahim · Wed 7 Oct 11:15–12:30 · DARB Office");
    expect(c.link).toBe(`/team/appointments?appointment=${APPOINTMENT.id}`);
  });

  it("1h: important priority, push + email, time-only body", () => {
    const c = buildReminderContent("t_1h", APPOINTMENT);
    expect(c.titleEn).toBe("Appointment in 1 hour");
    expect(c.priority).toBe("high");
    expect(c.email).toBe(true);
    expect(c.bodyEn).toBe("Ataa Ibrahim · 11:15–12:30 · DARB Office");
  });

  it("15m: time-sensitive priority, push only (no email)", () => {
    const c = buildReminderContent("t_15m", APPOINTMENT);
    expect(c.titleEn).toBe("Appointment starting soon");
    expect(c.titleAr).toBe("موعدك يبدأ بعد 15 دقيقة");
    expect(c.priority).toBe("time_sensitive");
    expect(c.email).toBe(false);
    expect(c.bodyEn).toBe("Ataa Ibrahim · 11:15–12:30 · DARB Office");
  });

  it("falls back to the case reference when no student name, and drops office", () => {
    const c = buildReminderContent("t_15m", {
      ...APPOINTMENT,
      studentName: null,
      officeName: null,
    });
    expect(c.bodyEn).toBe("DARB-1042 · 11:15–12:30");
  });

  it("handles a guest appointment with no person and no office", () => {
    const c = buildReminderContent("t_1h", {
      ...APPOINTMENT,
      studentName: "",
      caseReference: "",
      officeName: "",
    });
    expect(c.bodyEn).toBe("11:15–12:30");
  });

  it("gives each window a distinct per-appointment tag", () => {
    expect(buildReminderContent("t_24h", APPOINTMENT).tag).toBe(`appointment:${APPOINTMENT.id}:24h`);
    expect(buildReminderContent("t_1h", APPOINTMENT).tag).toBe(`appointment:${APPOINTMENT.id}:1h`);
    expect(buildReminderContent("t_15m", APPOINTMENT).tag).toBe(`appointment:${APPOINTMENT.id}:15m`);
  });
});

describe("appointmentIdFromLink", () => {
  it("extracts the id from a reminder deep link", () => {
    expect(appointmentIdFromLink(reminderLink(APPOINTMENT.id))).toBe(APPOINTMENT.id);
  });

  it("returns null for an absent or non-appointment link", () => {
    expect(appointmentIdFromLink(null)).toBe(null);
    expect(appointmentIdFromLink("/team/appointments")).toBe(null);
    expect(appointmentIdFromLink("/team/messages?conversation=abc")).toBe(null);
  });
});

describe("pushTag", () => {
  it("uses a per-appointment tag for appointment notifications", () => {
    const tag = pushTag({
      category: "appointments",
      link: reminderLink(APPOINTMENT.id),
      caseId: "case-1",
      notificationId: "n-1",
      priority: "time_sensitive",
    });
    expect(tag).toBe(`appointment:${APPOINTMENT.id}:time_sensitive`);
  });

  it("keeps two different appointments distinct", () => {
    const a = pushTag({
      category: "appointments",
      link: reminderLink(APPOINTMENT.id),
      caseId: null,
      notificationId: "n-1",
      priority: "time_sensitive",
    });
    const b = pushTag({
      category: "appointments",
      link: reminderLink("11111111-2222-3333-4444-555555555555"),
      caseId: null,
      notificationId: "n-2",
      priority: "time_sensitive",
    });
    expect(a).not.toBe(b);
  });

  it("preserves the existing scheme for non-appointment categories", () => {
    expect(
      pushTag({
        category: "messages",
        link: "/team/messages",
        caseId: "case-9",
        notificationId: "n-9",
        priority: "medium",
      }),
    ).toBe("messages:case-9");
    expect(
      pushTag({
        category: "system",
        link: null,
        caseId: null,
        notificationId: "n-9",
        priority: "medium",
      }),
    ).toBe("system:n-9");
  });

  it("falls back to the existing scheme when the appointment link is malformed", () => {
    expect(
      pushTag({
        category: "appointments",
        link: "/team/appointments",
        caseId: null,
        notificationId: "n-7",
        priority: "high",
      }),
    ).toBe("appointments:n-7");
  });
});

describe("reminderTag", () => {
  it("is stable and scoped to the appointment and window", () => {
    expect(reminderTag("abc-123", "t_15m")).toBe("appointment:abc-123:15m");
  });
});
