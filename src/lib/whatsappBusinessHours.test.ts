import { describe, expect, it } from "vitest";
import { getDarbBusinessHours, isDarbBusinessHours } from "./whatsappBusinessHours";

describe("DARB WhatsApp business hours", () => {
  it("is open Sunday through Thursday during 10:00–19:00 Jerusalem time", () => {
    expect(isDarbBusinessHours(new Date("2026-09-20T08:00:00Z"))).toBe(true);
    expect(isDarbBusinessHours(new Date("2026-09-20T17:00:00Z"))).toBe(false);
  });

  it("is closed on Friday and Saturday", () => {
    expect(getDarbBusinessHours(new Date("2026-09-25T10:00:00Z")).open).toBe(false);
    expect(getDarbBusinessHours(new Date("2026-09-26T10:00:00Z")).open).toBe(false);
  });
});
