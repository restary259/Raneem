import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Static guards for the appointment "starting soon" pipeline.
 *
 * These are the durable fences for the parts that are Deno/SQL/plain-JS and
 * therefore not executed by vitest: a future edit that silently drops the
 * 15-minute window, folds `time_sensitive` back into generic `high`, or
 * re-couples the push and email legs would otherwise regress with a green
 * suite.
 */

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("appointment reminder pipeline guards", () => {
  it("schedules the 15-minute window in sync_appointment_reminders", () => {
    const sql = fs
      .readdirSync(path.join(ROOT, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => read(path.join("supabase/migrations", f)))
      .join("\n");
    // The newest definition must contain all three windows.
    expect(sql).toMatch(/'t_15m'/);
    expect(sql).toMatch(/interval '15 minutes'/);
    expect(sql).toMatch(/CHECK \(kind IN \('t_24h', 't_1h', 't_15m'\)\)/);
  });

  it("tracks push and email delivery independently in the reminder worker", () => {
    const worker = read("supabase/functions/send-appointment-reminders/index.ts");
    expect(worker).toMatch(/push_sent_at/);
    expect(worker).toMatch(/email_sent_at/);
    // sent_at (the row's terminal marker) is only stamped once both channels
    // are accounted for, never after the push alone.
    expect(worker).toMatch(/const fullyDone = pushDone && emailDone/);
    expect(worker).toMatch(/if \(fullyDone\) patch\.sent_at/);
  });

  it("sends no email for the time-sensitive 15-minute alert", () => {
    const shared = read("supabase/functions/_shared/appointmentReminder.ts");
    expect(shared).toMatch(/t_15m:\s*\{[\s\S]*?email:\s*false/);
    expect(shared).toMatch(/priority:\s*"time_sensitive"/);
  });

  it("keeps time_sensitive distinct from high in the push dispatcher", () => {
    const dispatch = read("supabase/functions/push-dispatch/index.ts");
    expect(dispatch).toMatch(/priority === "time_sensitive"/);
    expect(dispatch).toMatch(/const isUrgent = priority === "high" \|\| priority === "time_sensitive"/);
    expect(dispatch).toMatch(/pushTag\(/);
  });

  it("routes time_sensitive to its own service-worker treatment", () => {
    const sw = read("public/service-worker.js");
    expect(sw).toMatch(/data\.priority === 'time_sensitive'/);
    expect(sw).toMatch(/TIME_SENSITIVE_VIBRATE/);
    // The call ring path must stay intact.
    expect(sw).toMatch(/const isCall = data\.category === 'calls'/);
    expect(sw).toMatch(/CALL_VIBRATE/);
  });

  it("deep-links a reminder to the exact appointment", () => {
    const route = read("src/routes/team.appointments.index.tsx");
    expect(route).toMatch(/appointment:/);
    const page = read("src/pages/team/TeamAppointmentsPage.tsx");
    expect(page).toMatch(/searchParams\.get\("appointment"\)/);
  });

  it("replaces emit_notification instead of overloading it", () => {
    // An 11-arg overload with a trailing default also matches a 10-arg call, so
    // PostgreSQL raises `function ... is not unique` (PGRST203) and every
    // existing trigger/worker caller breaks. The migration MUST drop the old
    // signatures and create exactly one function.
    const migration = read(
      "supabase/migrations/20260928160000_appointment_starting_soon.sql",
    );
    expect(migration).toMatch(
      /DROP FUNCTION IF EXISTS public\.emit_notification\(uuid, uuid, text, text, text, text, text, uuid, text, text\)/,
    );
    expect(migration).toMatch(
      /DROP FUNCTION IF EXISTS public\.emit_notification\(uuid, uuid, text, text, text, text, text, uuid, text, text, text\)/,
    );
    // Must NOT reintroduce the overload via CREATE OR REPLACE.
    expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION public\.emit_notification/);
    expect(migration).toMatch(/CREATE FUNCTION public\.emit_notification\(/);
    expect(migration).toMatch(/_priority text DEFAULT 'medium'/);
  });
});
