import { describe, expect, it } from "vitest";
import {
  formatDuration,
  isWhatsAppSlaOverdue,
  normalizeWhatsAppState,
  serviceWindowRemaining,
} from "./whatsappOperational";

describe("whatsapp operational helpers", () => {
  it("normalizes legacy state names", () => {
    expect(normalizeWhatsAppState("new")).toBe("waiting_for_team");
    expect(normalizeWhatsAppState("waiting")).toBe("waiting_for_team");
    expect(normalizeWhatsAppState("resolved")).toBe("closed");
    expect(normalizeWhatsAppState("waiting_for_student")).toBe("waiting_for_student");
  });

  it("detects overdue first-response SLA", () => {
    const now = Date.parse("2026-09-20T10:00:00Z");
    expect(isWhatsAppSlaOverdue({
      first_response_at: null,
      sla_due_at: "2026-09-20T09:59:59Z",
      state: "waiting_for_team",
    }, now)).toBe(true);
    expect(isWhatsAppSlaOverdue({
      first_response_at: "2026-09-20T09:30:00Z",
      last_customer_message_at: "2026-09-20T09:20:00Z",
      last_team_response_at: "2026-09-20T09:30:00Z",
      sla_due_at: "2026-09-20T09:59:59Z",
      state: "waiting_for_student",
    }, now)).toBe(false);
    expect(isWhatsAppSlaOverdue({
      first_response_at: "2026-09-20T09:30:00Z",
      last_customer_message_at: "2026-09-20T10:00:01Z",
      last_team_response_at: "2026-09-20T09:30:00Z",
      sla_due_at: "2026-09-20T09:59:59Z",
      state: "waiting_for_team",
    }, now)).toBe(true);
  });

  it("calculates the remaining service-window time", () => {
    const now = Date.parse("2026-09-20T10:00:00Z");
    expect(serviceWindowRemaining("2026-09-20T09:00:00Z", now)).toBe(23 * 60 * 60 * 1000);
    expect(formatDuration(serviceWindowRemaining("2026-09-19T09:00:00Z", now))).toBe("0m");
  });
});
