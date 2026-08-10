import { describe, it, expect } from "vitest";
import {
  CaseStatus,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  isTerminalStatus,
  isActiveStatus,
  CASE_STATUS_LABELS,
  resolveStatus,
} from "./caseStatus";
import { SLA_DAYS, getSlaDueAt, isSlaBreached, slaSummary } from "./slaPolicy";

describe("case status lifecycle helpers", () => {
  it("treats enrolled / forgotten / cancelled as terminal", () => {
    expect(TERMINAL_STATUSES).toEqual([
      CaseStatus.ENROLLMENT_PAID,
      CaseStatus.FORGOTTEN,
      CaseStatus.CANCELLED,
    ]);
    expect(isTerminalStatus(CaseStatus.ENROLLMENT_PAID)).toBe(true);
    expect(isTerminalStatus(CaseStatus.CANCELLED)).toBe(true);
    expect(isActiveStatus(CaseStatus.CANCELLED)).toBe(false);
  });

  it("treats pipeline stages as active", () => {
    expect(ACTIVE_STATUSES).toContain(CaseStatus.NEW);
    expect(ACTIVE_STATUSES).toContain(CaseStatus.SUBMITTED);
    expect(isActiveStatus(CaseStatus.NEW)).toBe(true);
    expect(isActiveStatus(CaseStatus.CONTACTED)).toBe(true);
  });

  it("never lets a terminal status count as active", () => {
    for (const s of ACTIVE_STATUSES) {
      expect(isTerminalStatus(s)).toBe(false);
    }
  });

  it("resolves unknown statuses and keeps them non-terminal by default", () => {
    expect(resolveStatus("not_a_status")).toBe(CaseStatus.NEW);
    expect(isTerminalStatus("not_a_status")).toBe(false);
  });

  it("provides en/ar labels for every canonical status", () => {
    for (const status of Object.values(CaseStatus)) {
      expect(CASE_STATUS_LABELS[status].en).toBeTruthy();
      expect(CASE_STATUS_LABELS[status].ar).toBeTruthy();
    }
  });
});

describe("SLA policy", () => {
  const base = new Date("2026-01-01T12:00:00Z").getTime();

  it("defines thresholds only for active stages", () => {
    expect(SLA_DAYS[CaseStatus.NEW]).toBe(3);
    expect(SLA_DAYS[CaseStatus.CONTACTED]).toBe(5);
    expect(SLA_DAYS[CaseStatus.APPT_SCHEDULED]).toBe(14);
    expect(SLA_DAYS[CaseStatus.PROFILE_COMPLETION]).toBe(7);
    expect(SLA_DAYS[CaseStatus.ENROLLMENT_PAID]).toBeUndefined();
    expect(SLA_DAYS[CaseStatus.CANCELLED]).toBeUndefined();
  });

  it("computes the due date from last activity", () => {
    const due = getSlaDueAt(CaseStatus.NEW, new Date(base).toISOString());
    expect(due!.getTime()).toBe(base + 3 * 86_400_000);
  });

  it("flags a case as breached after the threshold", () => {
    expect(isSlaBreached(CaseStatus.NEW, new Date(base).toISOString(), new Date(base))).toBe(false);
    expect(isSlaBreached(CaseStatus.NEW, new Date(base).toISOString(), new Date(base + 4 * 86_400_000))).toBe(true);
  });

  it("never flags terminal states as breached", () => {
    expect(isSlaBreached(CaseStatus.CANCELLED, new Date(base).toISOString(), new Date(base + 100 * 86_400_000))).toBe(false);
    expect(isSlaBreached(CaseStatus.ENROLLMENT_PAID, new Date(base).toISOString(), new Date(base + 100 * 86_400_000))).toBe(false);
  });

  it("handles missing or invalid dates", () => {
    expect(getSlaDueAt(CaseStatus.NEW, null)).toBeNull();
    expect(getSlaDueAt(CaseStatus.NEW, "not-a-date")).toBeNull();
    expect(isSlaBreached(CaseStatus.NEW, null)).toBe(false);
  });

  it("summarizes remaining and overdue time", () => {
    expect(slaSummary(CaseStatus.NEW, new Date(base).toISOString(), new Date(base))).toBe("3d left");
    expect(slaSummary(CaseStatus.NEW, new Date(base).toISOString(), new Date(base + 5 * 86_400_000))).toBe("2d overdue");
    expect(slaSummary(CaseStatus.CANCELLED, new Date(base).toISOString())).toBeNull();
  });
});
