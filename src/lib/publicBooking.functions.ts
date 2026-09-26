import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const request = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/), action: z.enum(["read", "book", "reschedule", "cancel", "availability"]), slot: z.string().datetime().optional() });

export const createPublicBookingLink = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ caseId: z.string().uuid(), phone: z.string().min(7).max(30), name: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: found, error } = await supabaseAdmin.from("cases")
      .select("id,full_name,phone_number,source,created_at").eq("id", data.caseId).eq("source", "apply_page").maybeSingle();
    // Never allow possession of a bare case ID to authorize an older case.
    if (error || !found || found.full_name.trim() !== data.name.trim() || found.phone_number.trim() !== data.phone.trim() || Date.now() - Date.parse(found.created_at) > 10 * 60 * 1000) throw new Error("We could not open booking. DARB will contact you.");
    const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const bytes = new TextEncoder().encode(token);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error: insertError } = await supabaseAdmin.rpc("create_public_appointment_access", { p_case_id: data.caseId, p_token_hash: hash });
    if (insertError) throw new Error("We could not open booking. DARB will contact you.");
    return { token };
  });

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
      const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const { data: occupied, error } = await supabaseAdmin.from("appointments")
        .select("scheduled_at, public_booking_end")
        .eq("public_booking", true).in("status", ["scheduled", "confirmed"]).is("outcome", null)
        .gte("scheduled_at", new Date(start.getTime() - 60 * 60 * 1000).toISOString()).lte("scheduled_at", end.toISOString());
      if (error) throw new Error("Times are temporarily unavailable.");
      const busy = occupied ?? [];
      const format = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "short", hour: "2-digit", hourCycle: "h23", minute: "2-digit" });
      const slots: string[] = [];
      for (let at = new Date(start.getTime() - start.getTime() % 3600000 + 3600000); at <= end; at = new Date(at.getTime() + 3600000)) {
        const parts = Object.fromEntries(format.formatToParts(at).map(({ type, value }) => [type, value]));
        const hour = Number(parts.hour);
        if (!["Sun", "Mon", "Tue", "Wed", "Thu"].includes(parts.weekday) || hour < 10 || hour > 17 || parts.minute !== "00") continue;
        if (!busy.some((row) => new Date(row.scheduled_at).getTime() < at.getTime() + 3600000 && new Date(row.public_booking_end ?? row.scheduled_at).getTime() > at.getTime())) slots.push(at.toISOString());
      }
      return { slots };
    }
    const { data: result, error } = await supabaseAdmin.rpc("manage_public_appointment", {
      p_token_hash: hash, p_action: data.action, p_slot: data.slot ?? null,
    });
    if (error) throw new Error(error.message.includes("Time unavailable") || error.message.includes("APPT_BLOCKED") ? "Time unavailable" : "Booking could not be updated. Please contact DARB.");
    return result;
  });