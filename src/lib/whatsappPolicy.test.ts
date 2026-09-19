import { describe, expect, it } from "vitest";
import { isInsideWhatsAppServiceWindow, requiresAdvisorReview, requiresApprovedTemplate } from "./whatsappPolicy";

describe("WhatsApp operational safety policy", () => {
  it("routes price, payment, visa, legal and human requests to an advisor", () => {
    for (const text of ["What is the price?", "I need a human", "سؤال عن الفيزا", "كيف أدفع؟", "هل القبول مضمون؟"]) {
      expect(requiresAdvisorReview(text)).toBe(true);
    }
    expect(requiresAdvisorReview("I want to study German in Düsseldorf")).toBe(false);
  });

  it("treats exactly 24 hours after an inbound message as inside the service window", () => {
    const inbound = "2026-09-18T12:00:00.000Z";
    expect(isInsideWhatsAppServiceWindow(inbound, new Date("2026-09-19T12:00:00.000Z"))).toBe(true);
    expect(requiresApprovedTemplate(inbound, new Date("2026-09-19T12:00:00.001Z"))).toBe(true);
  });

  it("requires a template when there is no inbound message", () => {
    expect(requiresApprovedTemplate(null)).toBe(true);
  });
});
