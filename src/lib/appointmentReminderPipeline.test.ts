import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Static guards for the appointment "starting soon" reminder pipeline.
 *
 * These are durable fences for the parts that are Deno/SQL/plain-JS and
 * therefore NOT executed by vitest. Each guard asserts behaviour that is
 * cheap to drop accidentally and expensive to miss:
 *   - the 15-minute window disappearing from the scheduling trigger,
 *   - the push and email legs being re-coupled (so a failed email re-pushes),
 *   - a 15-minute alert starting to send an email,
 *   - the lock-screen tag no longer being per-appointment (so two
 *     appointments overwrite each other),
 *   - the deep link regressing to the generic board,
 *   - the service-worker treatment being removed.
 *
 * Static text guards cannot prove runtime correctness; they exist so the
 * green suite stops being silent about these specific regressions. Runtime
 * behaviour is covered by the manual QA checklist in the PR.
 */

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Concatenated SQL of every migration, so a newest-wins definition passes. */
function allMigrations(): string {
  return fs
    .readdirSync(path.join(ROOT, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => read(path.join("supabase/migrations", f)))
    .join("\n");
}

describe("appointment reminder pipeline guards", () => {
  it("schedules all three reminder windows", () => {
    const sql = allMigrations();
    expect(sql).toMatch(/'t_24h'/);
    expect(sql).toMatch(/'t_1h'/);
    expect(sql).toMatch(/'t_15m'/);
    // The 15-minute window must be scheduled off the appointment time.
    expect(sql).toMatch(/interval '15 minutes'/);
    // The kind CHECK must permit t_15m or the insert would violate it.
    expect(sql).toMatch(/CHECK \(kind IN \('t_24h','t_1h','t_15m'\)\)/);
  });

  it("scopes reminders to the assigned team member only", () => {
    // The scheduling trigger reads NEW.team_member_id as the recipient, so a
    // reminder can never be broadcast. Losing this would notify the whole team.
    const sql = allMigrations();
    expect(sql).toMatch(/NEW\.team_member_id,'t_15m'/);
  });

  it("tracks push and email delivery independently", () => {
    const worker = read("supabase/functions/send-appointment-reminders/index.ts");
    expect(worker).toMatch(/push_sent_at/);
    expect(worker).toMatch(/email_sent_at/);
    // sent_at (the terminal marker) is only stamped after BOTH legs are
    // accounted for — never after the push alone, or a failed email would
    // re-send an already-delivered push on the next cron tick.
    expect(worker).toMatch(/if \(!pushOk \|\| !emailOk\)/);
    expect(worker).toMatch(/\.update\(\{ sent_at: now\(\) \}\)/);
  });

  it("does not send an email for the 15-minute alert", () => {
    const worker = read("supabase/functions/send-appointment-reminders/index.ts");
    // The email leg is short-circuited for t_15m (too late to be useful).
    expect(worker).toMatch(/let emailOk = kind === "t_15m" \|\| Boolean\(reminder\.email_sent_at\)/);
  });

  it("keeps the 15-minute alert high priority and tagged per appointment", () => {
    const worker = read("supabase/functions/send-appointment-reminders/index.ts");
    // The 15m window is urgent (not the neutral default).
    expect(worker).toMatch(/t_15m: \{[\s\S]*?priority: "high"/);
    // The push tag must carry the appointment id + window so two appointments
    // never replace each other on the lock screen.
    const dispatch = read("supabase/functions/push-dispatch/index.ts");
    expect(dispatch).toMatch(/appointment:\$\{meta\.appointment_id\}/);
  });

  it("deep-links a reminder to the exact appointment", () => {
    const worker = read("supabase/functions/send-appointment-reminders/index.ts");
    expect(worker).toMatch(/\/team\/appointments\?appointment=\$\{appt\.id\}/);
    // The board must actually read that query param and open the appointment.
    const page = read("src/pages/team/TeamAppointmentsPage.tsx");
    expect(page).toMatch(/params\.get\("appointment"\)/);
  });

  it("gives the 15-minute alert its own service-worker treatment", () => {
    const sw = read("public/service-worker.js");
    // The 15m alert must be persistent (survives Focus / Notification Summary).
    expect(sw).toMatch(/const isAppointmentSoon = isAppointment && data\.type === 'appointment_15m'/);
    expect(sw).toMatch(/requireInteraction: isCall \|\| isAppointmentSoon/);
    // Appointment reminders must not touch the unread icon badge.
    expect(sw).toMatch(/if \(isAppointment\) \{ \/\* leave badge untouched \*\/ \}/);
    // The call ring path must stay intact.
    expect(sw).toMatch(/const isCall = data\.category === 'calls'/);
    expect(sw).toMatch(/CALL_VIBRATE/);
  });
});
