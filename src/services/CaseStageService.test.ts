import { describe, it, expect, vi, beforeEach } from "vitest";
import { manualNextStages, stageBlockReason, cancelCase } from "./CaseStageService";

const updateSpy = vi.fn();
const rpcSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, _val: string) => {
          updateSpy(patch);
          return Promise.resolve({ error: null });
        },
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcSpy(fn, args);
      return Promise.resolve({ error: null });
    },
  },
}));

describe("stageBlockReason", () => {
  it("returns null while a manual forward move exists", () => {
    expect(stageBlockReason("new")).toBeNull();
    expect(manualNextStages("new")).toContain("contacted");
  });

  it("flags the final stage as terminal", () => {
    expect(stageBlockReason("enrollment_paid")).toEqual({ kind: "terminal" });
  });

  it("asks to reopen a cancelled case", () => {
    expect(stageBlockReason("cancelled")).toEqual({ kind: "inactive" });
  });

  it("treats a forgotten case as reopenable, not blocked", () => {
    // forgotten -> contacted is a manual edge, so the control stays enabled
    expect(stageBlockReason("forgotten")).toBeNull();
  });

  it("names the automated stage that comes next", () => {
    expect(stageBlockReason("profile_completion")).toEqual({
      kind: "automated",
      stage: "payment_confirmed",
    });
    expect(stageBlockReason("payment_confirmed")).toEqual({
      kind: "automated",
      stage: "submitted",
    });
    expect(stageBlockReason("submitted")).toEqual({
      kind: "automated",
      stage: "enrollment_paid",
    });
  });
});

describe("cancelCase", () => {
  beforeEach(() => {
    updateSpy.mockClear();
    rpcSpy.mockClear();
  });

  it("sets status to cancelled and logs a case_cancelled event with the reason", async () => {
    await cancelCase("case-1", "Changed their mind", "profile_completion");

    expect(updateSpy).toHaveBeenCalledWith({ status: "cancelled" });
    expect(rpcSpy).toHaveBeenCalledWith("log_case_event", {
      p_case_id: "case-1",
      p_event_type: "case_cancelled",
      p_payload: { from: "profile_completion", reason: "Changed their mind" },
      p_is_internal: false,
    });
  });

  it("normalizes a blank reason to null in the payload", async () => {
    await cancelCase("case-2", "   ", "contacted");

    expect(rpcSpy).toHaveBeenCalledWith("log_case_event", {
      p_case_id: "case-2",
      p_event_type: "case_cancelled",
      p_payload: { from: "contacted", reason: null },
      p_is_internal: false,
    });
  });

  it("is a no-op when the case is already cancelled (idempotent retry)", async () => {
    await cancelCase("case-3", "retry", "cancelled");

    expect(updateSpy).not.toHaveBeenCalled();
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("is a no-op on other terminal statuses (enrollment_paid, forgotten)", async () => {
    await cancelCase("case-4", "retry", "enrollment_paid");
    await cancelCase("case-5", "retry", "forgotten");

    expect(updateSpy).not.toHaveBeenCalled();
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("cancels from every active status (no transition-graph check)", async () => {
    for (const status of ["new", "contacted", "appointment_scheduled", "submitted"]) {
      updateSpy.mockClear();
      rpcSpy.mockClear();
      await cancelCase("case-x", "", status);
      expect(updateSpy).toHaveBeenCalledWith({ status: "cancelled" });
    }
  });
});
