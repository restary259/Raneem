import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const request = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  action: z.enum(["read", "offices", "availability", "book", "reschedule", "cancel"]),
  slot: z.string().datetime().optional(),
  officeId: z.string().uuid().optional(),
  officeSlug: z.string().trim().min(1).max(80).optional(),
  serviceType: z.string().trim().min(1).max(80).optional(),
});

type OfficeRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  name_he: string;
  city: string;
  country: string;
  address_line_1: string | null;
  phone: string | null;
  map_url: string | null;
  timezone: string;
};

// Resolves a public office slug to an id, refusing offices that are inactive,
// soft-deleted, or not accepting bookings. A client-supplied slug is never
// trusted as authorization — only the resolved id is used, and the appointment
// RPC re-validates the office before writing.
async function resolveBookableOfficeId(supabaseAdmin: any, slug: string | null | undefined): Promise<string | null> {
  if (!slug) return null;
  const result = await supabaseAdmin
    .from("offices")
    .select("id")
    .eq("slug", slug.trim().toLowerCase())
    .eq("is_active", true)
    .eq("booking_enabled", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (result.error) throw new Error("Offices are temporarily unavailable.");
  return result.data?.id ?? null;
}

type BookingMember = {
  user_id: string;
  is_primary: boolean;
  priority: number;
};

type BookingAppointment = {
  scheduled_at: string;
  public_booking_end: string | null;
  duration_minutes: number;
  team_member_id: string | null;
  office_id: string | null;
};

function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  return crypto.subtle.digest("SHA-256", bytes).then(function (digest) {
    return [...new Uint8Array(digest)].map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  });
}

function localParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(function (part) {
    return [part.type, part.value];
  }));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dateKey: parts.year + "-" + parts.month + "-" + parts.day,
  };
}

function weekdayIndex(date: { year: number; month: number; day: number }) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function localMinutes(parts: { hour: number; minute: number }) {
  return parts.hour * 60 + parts.minute;
}

function intervalOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function timeToMinutes(value: string) {
  const match = /^([0-2]\d):([0-5]\d)/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

async function getAuthorizedBookingRead(supabaseAdmin: any, tokenHash: string) {
  const result = await supabaseAdmin.rpc("manage_public_appointment", {
    p_token_hash: tokenHash,
    p_action: "read",
  });
  if (result.error) throw new Error("This booking link has expired or is invalid.");
  return (result.data || {}) as { scheduled_at?: string | null; status?: string | null; office_id?: string | null };
}

async function getBookableOffices(supabaseAdmin: any) {
  const officeResult = await supabaseAdmin
    .from("offices")
    .select("id,slug,name_ar,name_en,name_he,city,country,address_line_1,phone,map_url,timezone")
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("booking_enabled", true)
    .order("display_order")
    .order("name_en");

  if (officeResult.error) throw new Error("Offices are temporarily unavailable.");

  const offices = (officeResult.data || []) as OfficeRow[];
  if (!offices.length) return [];

  const membersResult = await supabaseAdmin
    .from("office_members")
    .select("office_id,user_id,is_active")
    .in("office_id", offices.map(function (o) { return o.id; }))
    .eq("is_active", true);

  if (membersResult.error) throw new Error("Offices are temporarily unavailable.");

  const userIds = [...new Set((membersResult.data || []).map(function (row: any) { return row.user_id; }))];
  if (!userIds.length) return [];

  const [rolesResult, profilesResult] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("user_id", userIds)
      .eq("role", "team_member"),
    supabaseAdmin
      .from("profiles")
      .select("id")
      .in("id", userIds)
      .is("deleted_at", null)
      .is("deactivated_at", null),
  ]);

  if (rolesResult.error || profilesResult.error) throw new Error("Offices are temporarily unavailable.");

  const roleTeamIds = new Set((rolesResult.data || []).map(function (row: any) { return row.user_id; }));
  const liveProfileIds = new Set((profilesResult.data || []).map(function (row: any) { return row.id; }));
  const teamIds = new Set(
    [...roleTeamIds].filter(function (id) { return liveProfileIds.has(id); }),
  );
  const validOfficeIds = new Set(
    (membersResult.data || [])
      .filter(function (row: any) { return teamIds.has(row.user_id); })
      .map(function (row: any) { return row.office_id; }),
  );

  return offices.filter(function (office) { return validOfficeIds.has(office.id); });
}

async function calculateAvailability(supabaseAdmin: any, officeId: string, serviceType = "consultation") {
  const officeResult = await supabaseAdmin
    .from("offices")
    .select("id,slug,name_ar,name_en,name_he,city,country,address_line_1,phone,map_url,timezone,booking_enabled,is_active")
    .eq("id", officeId)
    .maybeSingle();

  if (officeResult.error || !officeResult.data || !officeResult.data.is_active || !officeResult.data.booking_enabled) {
    throw new Error("Office unavailable");
  }

  const office = officeResult.data as OfficeRow;
  let timezone = office.timezone || "Asia/Jerusalem";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    timezone = "Asia/Jerusalem";
  }

  const [settingsResult, hoursResult, breaksResult, blackoutsResult, memberResult] = await Promise.all([
    supabaseAdmin.from("office_booking_settings").select("slot_interval_minutes,default_duration_minutes,minimum_lead_minutes,maximum_days_ahead").eq("office_id", officeId).maybeSingle(),
    supabaseAdmin.from("office_hours").select("weekday,is_open,open_time,close_time").eq("office_id", officeId).order("weekday"),
    supabaseAdmin.from("office_breaks").select("weekday,start_time,end_time").eq("office_id", officeId).eq("is_active", true),
    supabaseAdmin.from("office_blackouts").select("starts_at,ends_at").eq("office_id", officeId).eq("is_active", true),
    supabaseAdmin.from("office_members").select("user_id,is_primary,priority").eq("office_id", officeId).eq("is_active", true).order("is_primary", { ascending: false }).order("priority").order("created_at"),
  ]);

  for (const result of [settingsResult, hoursResult, breaksResult, blackoutsResult, memberResult]) {
    if (result.error) throw new Error("Office availability is temporarily unavailable.");
  }

  const settings = settingsResult.data || {
    slot_interval_minutes: 30,
    default_duration_minutes: 60,
    minimum_lead_minutes: 120,
    maximum_days_ahead: 14,
  };

  const members = (memberResult.data || []) as BookingMember[];
  if (!members.length) throw new Error("Office unavailable");

  const memberIds = members.map(function (member) { return member.user_id; });
  const [rolesResult, profilesResult] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("user_id", memberIds)
      .eq("role", "team_member"),
    supabaseAdmin
      .from("profiles")
      .select("id")
      .in("id", memberIds)
      .is("deleted_at", null)
      .is("deactivated_at", null),
  ]);
  if (rolesResult.error || profilesResult.error) throw new Error("Office availability is temporarily unavailable.");

  const roleTeamIds = new Set((rolesResult.data || []).map(function (row: any) { return row.user_id; }));
  const liveProfileIds = new Set((profilesResult.data || []).map(function (row: any) { return row.id; }));
  const activeTeamIds = new Set(
    [...roleTeamIds].filter(function (id) { return liveProfileIds.has(id); }),
  );
  const eligibleMembers = members.filter(function (member) { return activeTeamIds.has(member.user_id); });
  if (!eligibleMembers.length) throw new Error("Office unavailable");

  const now = new Date();
  const startMs = now.getTime() + Number(settings.minimum_lead_minutes || 0) * 60 * 1000;
  const endMs = now.getTime() + Number(settings.maximum_days_ahead || 14) * 24 * 60 * 60 * 1000;
  const intervalMs = Math.max(5, Number(settings.slot_interval_minutes || 30)) * 60 * 1000;
  const durationMs = Math.max(15, Number(settings.default_duration_minutes || 60)) * 60 * 1000;
  const first = new Date(Math.ceil(startMs / intervalMs) * intervalMs);
  const last = new Date(endMs);

  const appointmentResult = await supabaseAdmin
    .from("appointments")
    .select("scheduled_at,public_booking_end,duration_minutes,team_member_id,office_id")
    .in("team_member_id", eligibleMembers.map(function (member) { return member.user_id; }))
    .in("status", ["scheduled", "confirmed"])
    .is("outcome", null)
    .gte("scheduled_at", new Date(startMs - durationMs).toISOString())
    .lte("scheduled_at", new Date(endMs).toISOString());

  if (appointmentResult.error) throw new Error("Office availability is temporarily unavailable.");

  const busyAppointments = (appointmentResult.data || []) as BookingAppointment[];
  const hoursMap = new Map<number, { is_open: boolean; open_time: string | null; close_time: string | null }>();
  (hoursResult.data || []).forEach(function (row: any) {
    hoursMap.set(Number(row.weekday), { is_open: Boolean(row.is_open), open_time: row.open_time, close_time: row.close_time });
  });

  const breaks = (breaksResult.data || []).map(function (row: any) {
    return { weekday: Number(row.weekday), start: timeToMinutes(String(row.start_time)), end: timeToMinutes(String(row.end_time)) };
  });

  const blackouts = (blackoutsResult.data || []).map(function (row: any) {
    return { start: new Date(row.starts_at).getTime(), end: new Date(row.ends_at).getTime() };
  });

  const slots: string[] = [];
  const unavailable: string[] = [];

  for (let cursor = first.getTime(); cursor <= last.getTime(); cursor += intervalMs) {
    const start = new Date(cursor);
    const end = new Date(cursor + durationMs);
    if (end.getTime() > endMs) continue;

    const parts = localParts(start, timezone);
    const weekday = weekdayIndex(parts);
    const schedule = hoursMap.get(weekday);
    if (!schedule || !schedule.is_open || !schedule.open_time || !schedule.close_time) continue;

    const openMinutes = timeToMinutes(String(schedule.open_time));
    const closeMinutes = timeToMinutes(String(schedule.close_time));
    if (openMinutes === null || closeMinutes === null) continue;

    const startMinutes = localMinutes(parts);
    const endParts = localParts(end, timezone);
    const sameDay = endParts.dateKey === parts.dateKey;
    if (!sameDay) continue;
    const endMinutes = localMinutes(endParts);
    if (startMinutes < openMinutes || endMinutes > closeMinutes) continue;

    const inBreak = breaks.some(function (item: { weekday: number; start: number | null; end: number | null }) {
      return item.weekday === weekday && item.start !== null && item.end !== null &&
        intervalOverlap(startMinutes, endMinutes, item.start, item.end);
    });
    if (inBreak) {
      unavailable.push(start.toISOString());
      continue;
    }

    const inBlackout = blackouts.some(function (item: { start: number; end: number }) {
      return intervalOverlap(start.getTime(), end.getTime(), item.start, item.end);
    });
    if (inBlackout) {
      unavailable.push(start.toISOString());
      continue;
    }

    const freeMember = eligibleMembers.find(function (member) {
      return !busyAppointments.some(function (appointment) {
        if (appointment.team_member_id !== member.user_id) return false;
        const appointmentStart = new Date(appointment.scheduled_at).getTime();
        const appointmentEnd = appointment.public_booking_end
          ? new Date(appointment.public_booking_end).getTime()
          : appointmentStart + Number(appointment.duration_minutes || 60) * 60 * 1000;
        return intervalOverlap(start.getTime(), end.getTime(), appointmentStart, appointmentEnd);
      });
    });

    if (freeMember) slots.push(start.toISOString());
    else unavailable.push(start.toISOString());
  }

  return {
    office: {
      id: office.id,
      name_ar: office.name_ar,
      name_en: office.name_en,
      name_he: office.name_he,
      city: office.city,
      address_line_1: office.address_line_1,
      phone: office.phone,
      map_url: office.map_url,
      timezone: timezone,
      service_type: serviceType,
    },
    slots: slots,
    unavailable: unavailable,
  };
}

const publicBookingStartRequest = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  officeSlug: z.string().trim().min(1).max(80).optional(),
});

export const startPublicBooking = createServerFn({ method: "POST" })
  .inputValidator(function (input) { return publicBookingStartRequest.parse(input); })
  .handler(async function ({ data }) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // A public entry point (Google Business / campaign link) may carry an office
    // slug. It is resolved server-side so the case is attributed to the office
    // immediately — even if the applicant never books an appointment. An unknown
    // or unavailable slug is simply ignored rather than failing the booking.
    const officeId = await resolveBookableOfficeId(supabaseAdmin, data.officeSlug);

    const result = await supabaseAdmin.rpc("create_public_booking_session", {
      p_full_name: data.fullName,
      p_phone: data.phone,
      p_office_id: officeId ?? undefined,
    });

    if (result.error) {
      const message = String(result.error.message || "");
      if (message.includes("Too many booking requests")) {
        throw new Error("Too many booking requests");
      }
      throw new Error("Booking could not be started. Please check your details and try again.");
    }

    return (result.data || {}) as { token?: string; expires_at?: string };
  });

export const managePublicBooking = createServerFn({ method: "POST" })
  .inputValidator(function (input) { return request.parse(input); })
  .handler(async function ({ data }) {
    const tokenHash = await hashToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.action === "read") {
      return getAuthorizedBookingRead(supabaseAdmin, tokenHash);
    }

    if (data.action === "offices") {
      const current = await getAuthorizedBookingRead(supabaseAdmin, tokenHash);
      const offices = await getBookableOffices(supabaseAdmin);
      // `officeSlug` preselects the entry office without locking the applicant
      // in: the UI still shows the full list so they can switch if they want.
      const preferredOfficeId = await resolveBookableOfficeId(supabaseAdmin, data.officeSlug);
      return {
        offices: offices,
        current_office_id: current.office_id || null,
        preferred_office_id: preferredOfficeId,
      };
    }

    if (data.action === "availability") {
      const current = await getAuthorizedBookingRead(supabaseAdmin, tokenHash);
      const officeId = data.officeId || current.office_id || "";
      if (!officeId) throw new Error("Choose an office");
      return calculateAvailability(supabaseAdmin, officeId, data.serviceType || "consultation");
    }

    const result = await supabaseAdmin.rpc("manage_public_appointment", {
      p_token_hash: tokenHash,
      p_action: data.action,
      p_slot: data.slot,
      p_office_id: data.officeId || undefined,
      p_service_type: data.serviceType || "consultation",
    });

    if (result.error) {
      if (result.error.message.includes("Time unavailable") || result.error.message.includes("APPT_BLOCKED")) {
        return { error: "slot_taken" as const };
      }
      if (result.error.message.includes("Office unavailable")) {
        throw new Error("This office is not currently available for booking.");
      }
      throw new Error("Booking could not be updated. Please contact DARB.");
    }

    return result.data;
  });
