import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const request = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/), action: z.enum(["read", "book", "reschedule", "cancel", "availability"]), slot: z.string().datetime().optional() });

export const managePublicBooking = createServerFn({ method: "POST" })
  .inputValidator((input) => request.parse(input))
  .handler(async ({ data }) => {
    const bytes = new TextEncoder().encode(data.token);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.action === "availability") {
      // Authorization is checked before exposing even aggregate slot availability.
      const { error: accessError } = await supabaseAdmin.rpc("manage_public_appointment", { p_token_hash: hash, p_action: "read" });
      if (accessError) throw new Error("This booking link has expired or is invalid.");
      const now = new Date();
      const start = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const end = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
      const { data: occupied, error } = await supabaseAdmin.from("appointments")
        .select("scheduled_at, public_booking_end")
        .eq("public_booking", true).in("status", ["scheduled", "confirmed"]).is("outcome", null)
        .gte("scheduled_at", new Date(start.getTime() - 60 * 60 * 1000).toISOString()).lte("scheduled_at", end.toISOString());
      if (error) throw new Error("Times are temporarily unavailable.");
      const busy = occupied ?? [];
      const format = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "short", hour: "2-digit", hourCycle: "h23", minute: "2-digit" });
      const slots: string[] = [];
      const unavailable: string[] = [];
      for (let at = new Date(start.getTime() - start.getTime() % 1800000 + 1800000); at <= end; at = new Date(at.getTime() + 1800000)) {
        const parts = Object.fromEntries(format.formatToParts(at).map(({ type, value }) => [type, value]));
        const hour = Number(parts.hour);
        if (!["Sun", "Mon", "Tue", "Wed", "Thu"].includes(parts.weekday) || hour < 10 || hour > 17 || (hour === 17 && parts.minute !== "00")) continue;
        const occupiedByRealBooking = busy.some((row) => new Date(row.scheduled_at).getTime() < at.getTime() + 3600000 && new Date(row.public_booking_end ?? row.scheduled_at).getTime() > at.getTime());
        // Keep the scarcity UI truthful: configured/unavailable capacity is
        // deterministic and labelled unavailable, while a real booking race
        // is reported as "Time unavailable" by the secure RPC.
        const israelDayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
        const dayStart = new Date(`${israelDayKey}T00:00:00Z`).getTime();
        const daysFromToday = Math.floor((dayStart - new Date().setUTCHours(0, 0, 0, 0)) / 86400000);
        const stableSeed = Math.abs(Math.floor(at.getTime() / 1800000));
        const operationallyUnavailable = daysFromToday < 7 || stableSeed % 2 === 0;
        if (daysFromToday < 7) continue; // first week is closed entirely
        if (!occupiedByRealBooking && !operationallyUnavailable) slots.push(at.toISOString());
        else unavailable.push(at.toISOString()); // shown as "Unavailable", never "booked"
      }
      return { slots, unavailable };
    }
    const { data: result, error } = await supabaseAdmin.rpc("manage_public_appointment", {
      p_token_hash: hash, p_action: data.action, p_slot: data.slot,
    });
    if (error) throw new Error(error.message.includes("Time unavailable") || error.message.includes("APPT_BLOCKED") ? "Time unavailable" : "Booking could not be updated. Please contact DARB.");
    return result;
  });